using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using AgendamentoApi.Data;
using AgendamentoApi.DTOs;
using AgendamentoApi.Models;
using AgendamentoApi.Services; // Adicione este namespace

namespace AgendamentoApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AppointmentsController : ControllerBase
{
    private static readonly TimeSpan WorkStart = new(6, 0, 0);
    private static readonly TimeSpan WorkEnd = new(22, 0, 0);
    private static readonly TimeZoneInfo BrazilTz = BrazilTime.Zone;

    // Data/hora local de Brasília (Kind Unspecified) -> UTC
    private static DateTime LocalToUtc(DateTime date, TimeSpan time) =>
        TimeZoneInfo.ConvertTimeToUtc(
            DateTime.SpecifyKind(date.Date + time, DateTimeKind.Unspecified), BrazilTz);

    private static DateTime ToBrazil(DateTime utc) => BrazilTime.FromUtc(utc);

    // O atendimento inteiro (início e fim) precisa estar no mesmo dia, dentro do expediente
    private static bool IsWithinWorkHours(DateTime startUtc, DateTime endUtc)
    {
        var start = ToBrazil(startUtc);
        var end = ToBrazil(endUtc);
        return start.Date == end.Date && start.TimeOfDay >= WorkStart && end.TimeOfDay <= WorkEnd;
    }

    private const int MaxPeople = 20;
    private const int SlotStepMinutes = 30;
    private const int MaxImages = 5;
    private const long MaxImageBytes = 5 * 1024 * 1024;
    private static readonly System.Text.RegularExpressions.Regex ImageNameRegex =
        new(@"^[a-f0-9]{32}\.(jpg|png|webp)$");

    private readonly AppDbContext _context;
    private readonly string _uploadsDir;
    private readonly IWhatsAppService _whatsAppService;
    private readonly IGoogleCalendarService _calendarService; // Novo campo
    private readonly ITravelFeeService _travelFeeService;
    private readonly IDepositService _depositService;
    private readonly IManageTokenService _manageTokens;
    private readonly IPushNotificationService _pushService;
    private readonly IWebPushService _webPushService;

    public AppointmentsController(
        AppDbContext context,
        IWhatsAppService whatsAppService,
        IGoogleCalendarService calendarService, // Injetado aqui
        ITravelFeeService travelFeeService,
        IDepositService depositService,
        IManageTokenService manageTokens,
        IPushNotificationService pushService,
        IWebPushService webPushService,
        IWebHostEnvironment env,
        IConfiguration configuration)
    {
        _context = context;
        // No servidor aponta para um volume persistente (Storage__UploadsPath), senão as fotos somem a cada deploy
        var uploadsPath = configuration["Storage:UploadsPath"];
        _uploadsDir = string.IsNullOrWhiteSpace(uploadsPath) ? Path.Combine(env.ContentRootPath, "uploads") : uploadsPath;
        _whatsAppService = whatsAppService;
        _calendarService = calendarService;
        _travelFeeService = travelFeeService;
        _depositService = depositService;
        _manageTokens = manageTokens;
        _pushService = pushService;
        _webPushService = webPushService;
    }

    private const int MaxServices = 5;

    // Serviços de cada pessoa. Cada item de `perPerson` é "1,3" (ids de uma pessoa). Sem eles, vale o formato antigo:
    // os mesmos serviços para `people` pessoas. Null se algum serviço for inválido/inativo ou houver pessoas demais.
    private async Task<List<List<ServiceItem>>?> ResolveGroupsAsync(IEnumerable<string>? perPerson, IEnumerable<int> sharedIds, int people)
    {
        var groupIds = (perPerson ?? [])
            .Select(g => g.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(x => int.TryParse(x, out var n) ? n : 0).Where(n => n > 0).Distinct().ToList())
            .ToList();

        if (groupIds.Count == 0)
        {
            if (people < 1 || people > MaxPeople) return null;
            var shared = (sharedIds ?? []).Where(i => i > 0).Distinct().ToList();
            groupIds = Enumerable.Repeat(shared, people).ToList();
        }

        if (groupIds.Count < 1 || groupIds.Count > MaxPeople) return null;
        if (groupIds.Any(g => g.Count == 0 || g.Count > MaxServices)) return null;

        var all = groupIds.SelectMany(g => g).Distinct().ToList();
        var found = await _context.Services.Where(s => all.Contains(s.Id) && s.IsActive).ToListAsync();
        if (found.Count != all.Count) return null;
        var byId = found.ToDictionary(s => s.Id);
        return groupIds.Select(g => g.Select(id => byId[id]).ToList()).ToList();
    }

    private static int GroupsMinutes(List<List<ServiceItem>> groups) => groups.Sum(g => g.Sum(s => s.DurationMinutes));
    private static decimal GroupsPrice(List<List<ServiceItem>> groups) => groups.Sum(g => g.Sum(s => s.Price));

    // "Maquiagem + Penteado" quando todas fazem o mesmo; "Cliente 1: Maquiagem + Penteado; Cliente 2: Penteado" quando diferem
    private static string GroupsLabel(List<List<ServiceItem>> groups)
    {
        string Names(List<ServiceItem> g) => string.Join(" + ", g.Select(s => s.Name));
        var first = Names(groups[0]);
        if (groups.All(g => Names(g) == first)) return first;
        return string.Join("; ", groups.Select((g, i) => $"Cliente {i + 1}: {Names(g)}"));
    }

    // "1,3;3" -> ["1,3", "3"] (serviços de cada pessoa)
    private static List<string>? ParseGroups(string? groups) =>
        string.IsNullOrWhiteSpace(groups)
            ? null
            : groups.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

    // "1,3" (ou só o serviceId antigo) -> [1, 3]
    private static List<int> ParseServiceIds(string? csv, int single)
    {
        var ids = (csv ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => int.TryParse(x, out var n) ? n : 0)
            .ToList();
        if (ids.Count == 0) ids.Add(single);
        return ids;
    }

    // Pedidos antigos não têm o nome/valor gravados: cai no serviço único
    private static string ServiceLabel(Appointment a) => a.ServiceNames ?? a.ServiceItem?.Name ?? "Serviço";
    private static decimal ServicesTotal(Appointment a) => a.TotalPrice ?? (a.ServiceItem?.Price ?? 0) * a.People;

    // GET: api/appointments/estimate-fee?cep=01310100 (público)
    [HttpGet("estimate-fee")]
    [EnableRateLimiting("estimate")]
    public async Task<IActionResult> EstimateFee([FromQuery] string? cep, CancellationToken ct)
    {
        var digits = new string((cep ?? string.Empty).Where(char.IsDigit).ToArray());
        if (digits.Length != 8)
            return BadRequest(new { message = "Informe um CEP válido com 8 dígitos." });

        var r = await _travelFeeService.EstimateAsync(digits, ct);
        if (r == null)
            return NotFound(new { message = "CEP não encontrado ou fora da área de cobertura." });

        return Ok(new { cep = r.Cep, street = r.Street, neighborhood = r.Neighborhood, city = r.City, distanceKm = r.DistanceKm, travelFee = r.TravelFee });
    }

    // GET: api/appointments?date=2026-10-01 (Lista agendamentos de uma data específica)
    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<IEnumerable<Appointment>>> GetAppointments([FromQuery] string? date)
    {
        var query = _context.Appointments
            .Include(a => a.ServiceItem) // Junta com a tabela Services (JOIN)
            .AsQueryable();

        if (!string.IsNullOrEmpty(date))
        {
            if (DateTime.TryParse(date, out var parsedDate))
            {
                var dayStartUtc = LocalToUtc(parsedDate, TimeSpan.Zero);
                var dayEndUtc = LocalToUtc(parsedDate.AddDays(1), TimeSpan.Zero);
                query = query.Where(a => a.StartTime >= dayStartUtc && a.StartTime < dayEndUtc);
            }
            else
            {
                return BadRequest(new { message = "Formato de data inválido. Use AAAA-MM-DD." });
            }
        }

        var list = await query.OrderBy(a => a.StartTime).ToListAsync();
        return Ok(list);
    }

    // POST: api/appointments (Efetua a marcação validando conflitos)
    [HttpPost]
    [EnableRateLimiting("create")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<Appointment>> CreateAppointment([FromForm] CreateAppointmentDto dto)
    {
        // Um WhatsApp errado (ex.: 55 digitado no lugar do DDD) faz a Lari não conseguir falar com a cliente
        if (!PhoneNumber.IsValid(dto.ClientPhone))
        {
            return BadRequest(new { message = "Informe um WhatsApp válido com DDD, por exemplo (11) 91234-5678." });
        }

        // 0. Validar as imagens de referência antes de qualquer gravação
        var images = dto.Images ?? new List<IFormFile>();
        if (images.Count > MaxImages)
        {
            return BadRequest(new { message = $"Envie no máximo {MaxImages} imagens." });
        }
        var imageExts = new List<string>();
        foreach (var img in images)
        {
            if (img.Length == 0 || img.Length > MaxImageBytes)
            {
                return BadRequest(new { message = "Cada imagem deve ter até 5 MB." });
            }
            var ext = await DetectImageExtensionAsync(img);
            if (ext == null)
            {
                return BadRequest(new { message = "Formato de imagem não suportado. Use JPG, PNG ou WebP." });
            }
            imageExts.Add(ext);
        }

        // 1. Procurar os serviços para validar e somar a duração e o valor
        var groups = await ResolveGroupsAsync(dto.PersonServices,
            dto.ServiceItemIds is { Count: > 0 } ? dto.ServiceItemIds : [dto.ServiceItemId],
            Math.Clamp(dto.People, 1, MaxPeople));
        if (groups == null)
        {
            return BadRequest(new { message = "Serviço inválido ou inativo." });
        }
        var services = groups.SelectMany(g => g).DistinctBy(s => s.Id).ToList();
        var serviceNames = GroupsLabel(groups);

        // 2. A cliente informa o horário de início; o término é calculado somando a duração dos serviços de cada pessoa.
        var people = groups.Count;
        var startTimeUtc = dto.StartTime.UtcDateTime;
        var endTimeUtc = startTimeUtc.AddMinutes(GroupsMinutes(groups));

        if (!IsWithinWorkHours(startTimeUtc, endTimeUtc))
        {
            return BadRequest(new { message = "Esse horário não cabe no expediente (06:00 às 22:00) considerando o tempo total do serviço. Escolha um horário mais cedo." });
        }

        // 3. Regra de ouro: Verificar se existe sobreposição de horários
        // Existe sobreposição se: (InicioA < FimB) E (FimA > InicioB)
        bool hasConflict = await _context.Appointments
            .AnyAsync(a => !AppointmentStatus.FreeSlot.Contains(a.Status) &&
                           startTimeUtc < a.EndTime &&
                           endTimeUtc > a.StartTime);

        if (hasConflict)
        {
            return Conflict(new { message = "O horário selecionado já se encontra ocupado. Escolha outro intervalo." }); // HTTP 409
        }

        // 3.1 Taxa de deslocamento (recalculada no servidor; nunca confia no valor do cliente)
        TravelFeeResult? fee = null;
        if (!string.IsNullOrWhiteSpace(dto.Cep))
        {
            fee = await _travelFeeService.EstimateAsync(dto.Cep);
        }

        // 4. Gravar as imagens e o agendamento
        var savedImages = new List<string>();
        Directory.CreateDirectory(_uploadsDir);
        for (var i = 0; i < images.Count; i++)
        {
            var name = $"{Guid.NewGuid():N}.{imageExts[i]}";
            await using var fs = System.IO.File.Create(Path.Combine(_uploadsDir, name));
            await images[i].CopyToAsync(fs);
            savedImages.Add(name);
        }

        var appointment = new Appointment
        {
            ClientName = dto.ClientName,
            ClientPhone = dto.ClientPhone,
            ClientAddress = dto.ClientAddress,
            Description = dto.Description.Trim(),
            ReferenceImages = savedImages,
            TravelFee = fee?.TravelFee,
            DistanceKm = fee?.DistanceKm,
            ServiceItemId = services[0].Id,
            ServiceItemIds = services.Select(s => s.Id).ToList(),
            ServiceNames = serviceNames,
            TotalPrice = GroupsPrice(groups),
            People = people,
            StartTime = startTimeUtc,
            EndTime = endTimeUtc,
            Status = AppointmentStatus.Pending // fica em análise até a maquiadora aprovar
        };
        _context.Appointments.Add(appointment);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            DeleteImages(savedImages);
            if (!IsOverlapViolation(ex)) throw;
            // A constraint de exclusão do banco pegou uma marcação concorrente
            return Conflict(new { message = "O horário selecionado já se encontra ocupado. Escolha outro intervalo." });
        }

        // Pedido recebido: avisa a cliente (em análise); a maquiadora vê o pedido no Painel Ateliê.
        // A confirmação e o evento no Google Calendar só acontecem quando a maquiadora aprova.
        await _whatsAppService.SendRequestReceivedAsync(
            appointment.ClientPhone, appointment.ClientName, serviceNames,
            ToBrazil(appointment.StartTime), ToBrazil(appointment.EndTime),
            _manageTokens.BuildUrl(appointment.Id));

        // Notificação push para a maquiadora ver o pedido na hora: no painel do site (Web Push, funciona no iPhone) e no app
        await _webPushService.NotifyNewBookingAsync(appointment, serviceNames);
        await _pushService.NotifyNewBookingAsync(appointment, serviceNames);

        // Só o id e o código secreto: com ele a cliente acompanha e cancela o pedido (nunca o registro inteiro)
        return StatusCode(StatusCodes.Status201Created,
            new { id = appointment.Id, manageToken = _manageTokens.Create(appointment.Id) });
    }

    // GET: api/appointments/pending (pedidos futuros aguardando aprovação, de qualquer data)
    [HttpGet("pending")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<IEnumerable<Appointment>>> GetPending()
    {
        var now = DateTime.UtcNow;
        var list = await _context.Appointments
            .Include(a => a.ServiceItem)
            .Where(a => a.Status == AppointmentStatus.Pending && a.StartTime >= now)
            .OrderBy(a => a.StartTime)
            .ToListAsync();
        return Ok(list);
    }

    // POST: api/appointments/5/approve (pedido em análise -> confirmado; avisa a cliente e cria o evento na agenda)
    [HttpPost("{id}/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<Appointment>> Approve(int id)
    {
        var appointment = await _context.Appointments
            .Include(a => a.ServiceItem)
            .FirstOrDefaultAsync(a => a.Id == id);
        if (appointment == null)
            return NotFound(new { message = "Agendamento não encontrado." });
        if (!await TryLeavePendingAsync(appointment, AppointmentStatus.Confirmed))
            return Conflict(new { message = "Este agendamento não está mais em análise." });

        // O sinal é calculado ao aprovar (serviços + deslocamento) e vai junto da confirmação, com o PIX
        var deposit = _depositService.Calculate(ServicesTotal(appointment) + (appointment.TravelFee ?? 0));
        appointment.DepositAmount = deposit;
        await _context.Appointments.Where(a => a.Id == appointment.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.DepositAmount, deposit));

        var serviceName = ServiceLabel(appointment);
        await _whatsAppService.SendConfirmationMessageAsync(
            appointment.ClientPhone, appointment.ClientName, serviceName,
            ToBrazil(appointment.StartTime), ToBrazil(appointment.EndTime),
            deposit, _depositService.BuildPixCode(appointment.Id, deposit),
            _manageTokens.BuildUrl(appointment.Id));
        var eventId = await _calendarService.CreateEventAsync(
            $"{serviceName} - {appointment.ClientName}",
            BuildCalendarDescription(appointment),
            appointment.StartTime,
            appointment.EndTime);
        if (eventId != null)
        {
            appointment.GoogleEventId = eventId;
            await _context.Appointments.Where(a => a.Id == appointment.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.GoogleEventId, eventId));
        }

        return Ok(appointment);
    }

    // POST: api/appointments/5/reject (pedido em análise -> recusado; libera o horário e avisa a cliente)
    [HttpPost("{id}/reject")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<Appointment>> Reject(int id, [FromBody] RejectAppointmentDto? dto)
    {
        var appointment = await _context.Appointments
            .Include(a => a.ServiceItem)
            .FirstOrDefaultAsync(a => a.Id == id);
        if (appointment == null)
            return NotFound(new { message = "Agendamento não encontrado." });
        if (!await TryLeavePendingAsync(appointment, AppointmentStatus.Rejected))
            return Conflict(new { message = "Este agendamento não está mais em análise." });

        await _whatsAppService.SendRejectionMessageAsync(
            appointment.ClientPhone, appointment.ClientName, ServiceLabel(appointment),
            ToBrazil(appointment.StartTime), dto?.Reason);

        return Ok(appointment);
    }

    // GET: api/appointments/5/client-message?reason=... (link do WhatsApp da cliente com a mensagem pronta)
    // Confirmado: confirmação com o sinal e o PIX (ou só o aviso de sinal recebido). Recusado: o motivo vai em "reason".
    // A conversa abre no WhatsApp da própria maquiadora, então a mensagem sai do número dela.
    [HttpGet("{id}/client-message")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetClientMessage(int id, [FromQuery] string? reason)
    {
        var a = await _context.Appointments.Include(x => x.ServiceItem).FirstOrDefaultAsync(x => x.Id == id);
        if (a == null)
            return NotFound(new { message = "Agendamento não encontrado." });

        var start = ToBrazil(a.StartTime);
        var text = a.Status switch
        {
            AppointmentStatus.Confirmed => ClientMessages.Confirmation(
                a.ClientName, ServiceLabel(a), start, ToBrazil(a.EndTime),
                a.DepositAmount, a.DepositPaidAt != null,
                a.DepositAmount is > 0 ? _depositService.BuildPixCode(a.Id, a.DepositAmount.Value) : null,
                _manageTokens.BuildUrl(a.Id)),
            AppointmentStatus.Rejected => ClientMessages.Rejection(a.ClientName, ServiceLabel(a), start, reason),
            _ => null
        };
        if (text == null)
            return Conflict(new { message = "Só pedidos confirmados ou recusados têm mensagem para a cliente." });

        return Ok(new { url = ClientMessages.WhatsAppUrl(a.ClientPhone, text) });
    }

    // Tira o pedido de "em análise" só se ele ainda estiver assim no banco (UPDATE ... WHERE Status = 'Pending').
    // Evita que a aprovação sobrescreva um pedido que acabou de expirar, ou o contrário.
    private async Task<bool> TryLeavePendingAsync(Appointment appointment, string newStatus)
    {
        if (appointment.Status != AppointmentStatus.Pending) return false;
        var updated = await _context.Appointments
            .Where(a => a.Id == appointment.Id && a.Status == AppointmentStatus.Pending)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.Status, newStatus));
        if (updated == 0) return false;
        appointment.Status = newStatus;
        return true;
    }

    private static string BuildCalendarDescription(Appointment a)
    {
        var price = ServicesTotal(a);
        return $"Cliente: {a.ClientName}\nWhatsApp: {a.ClientPhone}\nEndereço: {a.ClientAddress}\nDescrição: {a.Description}\n" +
               $"Serviços: {ServiceLabel(a)}\nFotos de referência: {a.ReferenceImages.Count}\nClientes: {a.People}\n" +
               $"Início: {ToBrazil(a.StartTime):HH:mm} • Término previsto: {ToBrazil(a.EndTime):HH:mm}\nValor: R$ {price:F2}" +
               (a.TravelFee is decimal tf ? $"\nDeslocamento: {a.DistanceKm:F1} km • R$ {tf:F2}" : "");
    }


    private const int MaxLookupTokens = 20;

    private static MyAppointmentDto ToMyAppointment(Appointment a, string token, string? pixCode) => new()
    {
        Id = a.Id,
        ManageToken = token,
        ServiceName = ServiceLabel(a),
        Price = ServicesTotal(a),
        People = a.People,
        StartTime = a.StartTime,
        EndTime = a.EndTime,
        ClientAddress = a.ClientAddress,
        TravelFee = a.TravelFee,
        DistanceKm = a.DistanceKm,
        Status = a.Status,
        DepositAmount = a.DepositAmount,
        DepositPaid = a.DepositPaidAt != null,
        PixCode = pixCode
    };

    // POST: api/appointments/lookup (público; body { "tokens": ["12.abc..."] })
    // A cliente só vê o que tem o código secreto (guardado no aparelho ou no link enviado por WhatsApp).
    // Nunca se busca por telefone ou nome: saber o número de alguém não dá acesso ao agendamento dela.
    [HttpPost("lookup")]
    [EnableRateLimiting("lookup")]
    public async Task<ActionResult<IEnumerable<MyAppointmentDto>>> Lookup([FromBody] LookupDto dto)
    {
        var tokens = (dto.Tokens ?? []).Take(MaxLookupTokens).ToList();
        var byId = new Dictionary<int, string>();
        foreach (var token in tokens)
        {
            if (_manageTokens.TryGetAppointmentId(token) is int id) byId[id] = token.Trim();
        }
        if (byId.Count == 0) return Ok(Array.Empty<MyAppointmentDto>());

        var ids = byId.Keys.ToList();
        var now = DateTime.UtcNow;
        var found = await _context.Appointments
            .Include(a => a.ServiceItem)
            .Where(a => ids.Contains(a.Id) &&
                        (a.Status == AppointmentStatus.Pending || a.Status == AppointmentStatus.Confirmed) &&
                        a.StartTime >= now)
            .OrderBy(a => a.StartTime)
            .ToListAsync();

        var result = found.Select(a => ToMyAppointment(
            a,
            byId[a.Id],
            a.Status == AppointmentStatus.Confirmed && a.DepositAmount is > 0 && a.DepositPaidAt == null
                ? _depositService.BuildPixCode(a.Id, a.DepositAmount.Value)
                : null)).ToList();

        return Ok(result);
    }

    // POST: api/appointments/5/client-cancel (público; exige o código secreto do agendamento)
    [HttpPost("{id}/client-cancel")]
    [EnableRateLimiting("lookup")]
    public async Task<IActionResult> ClientCancel(int id, [FromBody] ClientCancelDto dto)
    {
        // Mesma resposta para "não existe" e "código não confere", para não revelar agendamentos de terceiros
        var appointment = _manageTokens.TryGetAppointmentId(dto.Token) == id
            ? await _context.Appointments.FindAsync(id)
            : null;
        if (appointment == null ||
            (appointment.Status != AppointmentStatus.Pending && appointment.Status != AppointmentStatus.Confirmed))
        {
            return NotFound(new { message = "Agendamento não encontrado." });
        }

        // Pedido ainda em análise pode ser retirado a qualquer momento; confirmado só com mais de 24 h
        if (appointment.Status == AppointmentStatus.Confirmed && appointment.StartTime <= DateTime.UtcNow.AddHours(24))
        {
            return BadRequest(new { message = "Cancelamentos com menos de 24 horas de antecedência devem ser feitos pelo WhatsApp." });
        }

        appointment.Status = AppointmentStatus.Cancelled;
        await _context.SaveChangesAsync();
        await RemoveCalendarEventAsync(appointment);

        return NoContent();
    }

    // Tira da agenda do Google o evento de um atendimento desmarcado
    private async Task RemoveCalendarEventAsync(Appointment appointment)
    {
        if (appointment.GoogleEventId == null) return;
        await _calendarService.DeleteEventAsync(appointment.GoogleEventId);
        appointment.GoogleEventId = null;
        await _context.SaveChangesAsync();
    }

    // GET: api/appointments/images/{fileName} (somente a maquiadora vê as fotos das clientes)
    [HttpGet("images/{fileName}")]
    [Authorize(Roles = "Admin")]
    public IActionResult GetImage(string fileName)
    {
        // Só aceita os nomes gerados por nós (evita path traversal)
        if (!ImageNameRegex.IsMatch(fileName)) return NotFound();
        var path = Path.Combine(_uploadsDir, fileName);
        if (!System.IO.File.Exists(path)) return NotFound();
        var contentType = fileName.EndsWith(".png") ? "image/png"
            : fileName.EndsWith(".webp") ? "image/webp" : "image/jpeg";
        return PhysicalFile(path, contentType);
    }

    // Detecta o tipo real pelos primeiros bytes (não confia no nome/Content-Type enviados)
    private static async Task<string?> DetectImageExtensionAsync(IFormFile file)
    {
        var h = new byte[12];
        await using var s = file.OpenReadStream();
        var read = await s.ReadAsync(h.AsMemory(0, 12));
        if (read < 12) return null;
        if (h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF) return "jpg";
        if (h[0] == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47) return "png";
        if (h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F' &&
            h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P') return "webp";
        return null;
    }

    private void DeleteImages(IEnumerable<string> names)
    {
        foreach (var n in names)
        {
            try { System.IO.File.Delete(Path.Combine(_uploadsDir, n)); } catch { }
        }
    }

    // GET: api/appointments/available-slots?date=2026-09-27&serviceId=1&people=2 (ou serviceIds=1,3 para vários serviços)
    // Devolve os horários de INÍCIO em que o atendimento inteiro (serviço x pessoas) cabe livre no expediente.
    [HttpGet("available-slots")]
    public async Task<ActionResult<IEnumerable<string>>> GetAvailableSlots([FromQuery] string date, [FromQuery] int serviceId, [FromQuery] string? serviceIds, [FromQuery] string? groups, [FromQuery] int people = 1)
    {
        // 1. Validar e converter a string "YYYY-MM-DD"
        if (!DateTime.TryParse(date, out var parsedDate))
        {
            return BadRequest(new { message = "Formato de data inválido. Use AAAA-MM-DD." });
        }

        if (people < 1 || people > MaxPeople)
        {
            return BadRequest(new { message = $"A quantidade de pessoas deve ser de 1 a {MaxPeople}." });
        }

        // 2. Buscar os serviços de cada pessoa (groups="1,2;2") ou o formato antigo (serviceIds x people)
        var resolved = await ResolveGroupsAsync(ParseGroups(groups), ParseServiceIds(serviceIds, serviceId), people);
        if (resolved == null)
        {
            return BadRequest(new { message = "Serviço inválido ou inativo." });
        }
        var totalMinutes = GroupsMinutes(resolved);

        // 3. Agendamentos e bloqueios (não cancelados) que tocam o expediente (06:00-22:00 em Brasília)
        var existingAppointments = await BusyIntervalsAsync(LocalToUtc(parsedDate, WorkStart), LocalToUtc(parsedDate, WorkEnd));

        return Ok(ComputeSlots(parsedDate, totalMinutes, existingAppointments));
    }

    private const int MaxAvailabilityDays = 62;

    // GET: api/appointments/availability?from=2026-10-19&days=31&serviceId=1&people=1
    // Quantos horários de início livres há em cada dia do período (o calendário do site marca os dias livres e lotados).
    [HttpGet("availability")]
    public async Task<IActionResult> GetAvailability([FromQuery] string from, [FromQuery] int days, [FromQuery] int serviceId, [FromQuery] string? serviceIds, [FromQuery] string? groups, [FromQuery] int people = 1)
    {
        if (!DateTime.TryParse(from, out var fromDate))
        {
            return BadRequest(new { message = "Formato de data inválido. Use AAAA-MM-DD." });
        }

        if (days < 1 || days > MaxAvailabilityDays)
        {
            return BadRequest(new { message = $"O período deve ter de 1 a {MaxAvailabilityDays} dias." });
        }

        if (people < 1 || people > MaxPeople)
        {
            return BadRequest(new { message = $"A quantidade de pessoas deve ser de 1 a {MaxPeople}." });
        }

        var resolved = await ResolveGroupsAsync(ParseGroups(groups), ParseServiceIds(serviceIds, serviceId), people);
        if (resolved == null)
        {
            return BadRequest(new { message = "Serviço inválido ou inativo." });
        }
        var totalMinutes = GroupsMinutes(resolved);

        // Uma consulta só para o período inteiro
        var existingAppointments = await BusyIntervalsAsync(
            LocalToUtc(fromDate, WorkStart), LocalToUtc(fromDate.AddDays(days - 1), WorkEnd));

        var result = Enumerable.Range(0, days).Select(i =>
        {
            var day = fromDate.Date.AddDays(i);
            return new { date = day.ToString("yyyy-MM-dd"), slots = ComputeSlots(day, totalMinutes, existingAppointments).Count };
        });

        return Ok(result);
    }

    // Agendamentos e bloqueios que ocupam a agenda e tocam o intervalo [inicioUtc, fimUtc]
    private Task<List<Appointment>> BusyIntervalsAsync(DateTime startUtc, DateTime endUtc) =>
        _context.Appointments
            .Where(a => !AppointmentStatus.FreeSlot.Contains(a.Status) &&
                        a.StartTime < endUtc &&
                        a.EndTime > startUtc)
            .ToListAsync();

    // Horários de INÍCIO livres num dia, em blocos de 30 minutos. O atendimento ocupa
    // [início, início + duração total], precisa caber inteiro no expediente e não pode começar no passado.
    private static List<string> ComputeSlots(DateTime day, int totalMinutes, List<Appointment> existingAppointments)
    {
        var workStartUtc = LocalToUtc(day, WorkStart);
        var workEndUtc = LocalToUtc(day, WorkEnd);
        var now = DateTime.UtcNow;
        var slots = new List<string>();

        for (var start = workStartUtc; start < workEndUtc; start = start.AddMinutes(SlotStepMinutes))
        {
            var end = start.AddMinutes(totalMinutes);
            if (end > workEndUtc) break;
            if (start <= now) continue;

            // Verifica colisão: (InicioNovo < FimExistente) E (FimNovo > InicioExistente)
            bool isBusy = existingAppointments.Any(a => start < a.EndTime && end > a.StartTime);

            if (!isBusy)
            {
                // Retorna em horário local de Brasília
                slots.Add(TimeZoneInfo.ConvertTimeFromUtc(start, BrazilTz).ToString("HH:mm"));
            }
        }

        return slots;
    }

    // POST: api/appointments/5/deposit-paid (a maquiadora marca que recebeu o sinal; repetir não faz mal)
    [HttpPost("{id}/deposit-paid")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<Appointment>> MarkDepositPaid(int id)
    {
        var appointment = await _context.Appointments.Include(a => a.ServiceItem).FirstOrDefaultAsync(a => a.Id == id);
        if (appointment == null)
            return NotFound(new { message = "Agendamento não encontrado." });
        if (appointment.Status != AppointmentStatus.Confirmed || appointment.DepositAmount is not > 0)
            return Conflict(new { message = "Só pedidos confirmados têm sinal a receber." });

        appointment.DepositPaidAt ??= DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return Ok(appointment);
    }

    // PATCH: api/appointments/5/status (desmarcar atendimento ou desbloquear agenda; body: "Cancelled")
    // Aprovar e recusar pedidos usam /approve e /reject, que também avisam a cliente.
    [HttpPatch("{id}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] string newStatus)
    {
        if (newStatus != AppointmentStatus.Cancelled)
        {
            return BadRequest(new { message = "Só é possível mudar para \"Cancelled\" por aqui. Para aprovar ou recusar, use /approve ou /reject." });
        }

        var appointment = await _context.Appointments.FindAsync(id);
        if (appointment == null)
        {
            return NotFound(new { message = "Agendamento não encontrado." });
        }

        appointment.Status = newStatus;
        await _context.SaveChangesAsync();
        await RemoveCalendarEventAsync(appointment);

        return NoContent(); // HTTP 204
    }

    // POST: api/appointments/block-slot
    [HttpPost("block-slot")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<Appointment>> BlockSlot([FromBody] BlockSlotDto dto)
    {
        // 1. Horários locais de Brasília (sem horário informado => expediente completo)
        TimeSpan startTime = dto.StartTime ?? WorkStart;
        TimeSpan endTime = dto.EndTime ?? WorkEnd;

        // 2. Validar horários
        if (startTime >= endTime)
        {
            return BadRequest(new { message = "Horário de início deve ser anterior ao horário de fim." });
        }

        if (startTime < WorkStart || endTime > WorkEnd)
        {
            return BadRequest(new { message = "Horário deve estar entre 06:00 e 22:00." });
        }

        // 3. Converter de Brasília para UTC
        var startDateTime = LocalToUtc(dto.Date, startTime);
        var endDateTime = LocalToUtc(dto.Date, endTime);

        // 4. Verificar conflitos com agendamentos existentes (exceto cancelados)
        bool hasConflict = await _context.Appointments
            .AnyAsync(a => !AppointmentStatus.FreeSlot.Contains(a.Status) &&
                           startDateTime < a.EndTime &&
                           endDateTime > a.StartTime);

        if (hasConflict)
        {
            return Conflict(new { message = "O horário selecionado já possui agendamentos. Não é possível bloquear." });
        }

        // 6. Obter o primeiro serviço ativo ou criar um serviço dummy se nenhum existir
        var service = await _context.Services
            .Where(s => s.IsActive)
            .OrderBy(s => s.Id)
            .FirstOrDefaultAsync();

        // Se não houver serviço ativo, usamos um ID padrão (assumindo que o ID 1 existe ou criaremos um serviço dummy)
        // Para simplificação, vamos assumir que sempre haverá pelo menos um serviço
        if (service == null)
        {
            // Se não houver serviços ativos, vamos buscar qualquer serviço ou criar um dummy
            service = await _context.Services.FirstOrDefaultAsync();

            if (service == null)
            {
                return BadRequest(new { message = "Nenhum serviço encontrado no sistema." });
            }
        }

        // 7. Criar o agendamento de bloqueio
        var blockedAppointment = new Appointment
        {
            ClientName = $"[BLOQUEIO] {dto.Reason ?? "Folga / Indisponível"}",
            ClientPhone = "00000000000",
            ServiceItemId = service.Id,
            StartTime = startDateTime,
            EndTime = endDateTime,
            Status = AppointmentStatus.Blocked,
            CreatedAt = DateTime.UtcNow
        };

        _context.Appointments.Add(blockedAppointment);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (Exception ex) when (IsOverlapViolation(ex))
        {
            return Conflict(new { message = "O horário selecionado já possui agendamentos. Não é possível bloquear." });
        }

        return CreatedAtAction(nameof(GetAppointments), new { id = blockedAppointment.Id }, blockedAppointment);
    }

    // 23P01 = exclusion_violation (constraint no_overlapping_appointments).
    // 40P01 = deadlock_detected: inserções simultâneas sobrepostas num índice GiST podem fazer o
    // Postgres abortar uma delas assim; a outra transação venceu o horário, então também é conflito.
    private static bool IsOverlapViolation(Exception ex)
    {
        // O EF pode embrulhar o erro transitório (deadlock) numa InvalidOperationException, então percorre a cadeia
        for (var e = ex; e != null; e = e.InnerException)
        {
            if (e is PostgresException
                {
                    SqlState: PostgresErrorCodes.ExclusionViolation or PostgresErrorCodes.DeadlockDetected
                })
            {
                return true;
            }
        }
        return false;
    }
}