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
    private static readonly TimeZoneInfo BrazilTz = ResolveBrazilTimeZone();

    private static TimeZoneInfo ResolveBrazilTimeZone()
    {
        foreach (var id in new[] { "America/Sao_Paulo", "E. South America Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        throw new InvalidOperationException("Fuso horário de Brasília não encontrado no sistema.");
    }

    // Data/hora local de Brasília (Kind Unspecified) -> UTC
    private static DateTime LocalToUtc(DateTime date, TimeSpan time) =>
        TimeZoneInfo.ConvertTimeToUtc(
            DateTime.SpecifyKind(date.Date + time, DateTimeKind.Unspecified), BrazilTz);

    private static DateTime ToBrazil(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), BrazilTz);

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

    public AppointmentsController(
        AppDbContext context,
        IWhatsAppService whatsAppService,
        IGoogleCalendarService calendarService, // Injetado aqui
        ITravelFeeService travelFeeService,
        IWebHostEnvironment env)
    {
        _context = context;
        _uploadsDir = Path.Combine(env.ContentRootPath, "uploads");
        _whatsAppService = whatsAppService;
        _calendarService = calendarService;
        _travelFeeService = travelFeeService;
    }

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

        // 1. Procurar o serviço para validar a duração
        var service = await _context.Services.FindAsync(dto.ServiceItemId);
        if (service == null || !service.IsActive)
        {
            return BadRequest(new { message = "Serviço inválido ou inativo." });
        }

        // 2. A cliente informa o horário de início; o término é calculado somando a duração total (serviço x pessoas).
        var people = Math.Clamp(dto.People, 1, MaxPeople);
        var startTimeUtc = dto.StartTime.UtcDateTime;
        var endTimeUtc = startTimeUtc.AddMinutes(service.DurationMinutes * people);

        if (!IsWithinWorkHours(startTimeUtc, endTimeUtc))
        {
            return BadRequest(new { message = "Esse horário não cabe no expediente (06:00 às 22:00) considerando o tempo total do serviço. Escolha um horário mais cedo." });
        }

        // 3. Regra de ouro: Verificar se existe sobreposição de horários
        // Existe sobreposição se: (InicioA < FimB) E (FimA > InicioB)
        bool hasConflict = await _context.Appointments
            .AnyAsync(a => a.Status != AppointmentStatus.Cancelled &&
                           a.Status != AppointmentStatus.Rejected &&
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
            ServiceItemId = dto.ServiceItemId,
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

        // Pedido recebido: avisa a cliente (em análise) e a maquiadora (novo pedido).
        // A confirmação e o evento no Google Calendar só acontecem quando a maquiadora aprova.
        await _whatsAppService.SendRequestReceivedAsync(
            appointment.ClientPhone, appointment.ClientName, service.Name,
            ToBrazil(appointment.StartTime), ToBrazil(appointment.EndTime));
        await _whatsAppService.NotifyOwnerNewRequestAsync(
            appointment.ClientName, appointment.ClientPhone, service.Name,
            ToBrazil(appointment.StartTime), ToBrazil(appointment.EndTime));

        return CreatedAtAction(nameof(GetAppointments), new { id = appointment.Id }, appointment);
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
        if (appointment.Status != AppointmentStatus.Pending)
            return Conflict(new { message = "Este agendamento não está mais em análise." });

        appointment.Status = AppointmentStatus.Confirmed;
        await _context.SaveChangesAsync();

        var serviceName = appointment.ServiceItem?.Name ?? "Serviço";
        await _whatsAppService.SendConfirmationMessageAsync(
            appointment.ClientPhone, appointment.ClientName, serviceName,
            ToBrazil(appointment.StartTime), ToBrazil(appointment.EndTime));
        await _calendarService.CreateEventAsync(
            $"{serviceName} - {appointment.ClientName}",
            BuildCalendarDescription(appointment),
            appointment.StartTime,
            appointment.EndTime);

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
        if (appointment.Status != AppointmentStatus.Pending)
            return Conflict(new { message = "Este agendamento não está mais em análise." });

        appointment.Status = AppointmentStatus.Rejected;
        await _context.SaveChangesAsync();

        await _whatsAppService.SendRejectionMessageAsync(
            appointment.ClientPhone, appointment.ClientName, appointment.ServiceItem?.Name ?? "Serviço",
            ToBrazil(appointment.StartTime), dto?.Reason);

        return Ok(appointment);
    }

    private static string BuildCalendarDescription(Appointment a)
    {
        var price = (a.ServiceItem?.Price ?? 0) * a.People;
        return $"Cliente: {a.ClientName}\nWhatsApp: {a.ClientPhone}\nEndereço: {a.ClientAddress}\nDescrição: {a.Description}\n" +
               $"Fotos de referência: {a.ReferenceImages.Count}\nPessoas: {a.People}\n" +
               $"Início: {ToBrazil(a.StartTime):HH:mm} • Término previsto: {ToBrazil(a.EndTime):HH:mm}\nValor: R$ {price:F2}" +
               (a.TravelFee is decimal tf ? $"\nDeslocamento: {a.DistanceKm:F1} km • R$ {tf:F2}" : "");
    }


    // Só os dígitos; tira o DDI 55 quando o número vem completo (13 dígitos) para comparar com o salvo
    private static string NormalizePhone(string? phone)
    {
        var digits = new string((phone ?? string.Empty).Where(char.IsDigit).ToArray());
        return digits.Length > 11 && digits.StartsWith("55") ? digits[2..] : digits;
    }

    // GET: api/appointments/my-appointments?phone=(11) 99999-9999 (público)
    [HttpGet("my-appointments")]
    [EnableRateLimiting("lookup")]
    public async Task<ActionResult<IEnumerable<MyAppointmentDto>>> GetMyAppointments([FromQuery] string? phone)
    {
        var wanted = NormalizePhone(phone);
        if (wanted.Length < 10)
        {
            return BadRequest(new { message = "Informe um WhatsApp válido." });
        }

        // Telefones são salvos com máscara; a comparação por dígitos é feita em memória
        // sobre os futuros em análise ou confirmados (conjunto pequeno).
        var now = DateTime.UtcNow;
        var future = await _context.Appointments
            .Include(a => a.ServiceItem)
            .Where(a => (a.Status == AppointmentStatus.Pending || a.Status == AppointmentStatus.Confirmed) &&
                        a.StartTime >= now)
            .OrderBy(a => a.StartTime)
            .ToListAsync();

        var result = future
            .Where(a => NormalizePhone(a.ClientPhone) == wanted)
            .Select(a => new MyAppointmentDto
            {
                Id = a.Id,
                ServiceName = a.ServiceItem?.Name ?? "Serviço",
                Price = (a.ServiceItem?.Price ?? 0) * a.People,
                People = a.People,
                StartTime = a.StartTime,
                EndTime = a.EndTime,
                ClientAddress = a.ClientAddress,
                TravelFee = a.TravelFee,
                DistanceKm = a.DistanceKm,
                Status = a.Status
            })
            .ToList();

        return Ok(result);
    }

    // POST: api/appointments/5/client-cancel (público; exige o telefone do agendamento)
    [HttpPost("{id}/client-cancel")]
    [EnableRateLimiting("lookup")]
    public async Task<IActionResult> ClientCancel(int id, [FromBody] ClientCancelDto dto)
    {
        var appointment = await _context.Appointments.FindAsync(id);

        // Mesma resposta para "não existe" e "telefone não confere", para não revelar agendamentos de terceiros
        if (appointment == null ||
            (appointment.Status != AppointmentStatus.Pending && appointment.Status != AppointmentStatus.Confirmed) ||
            NormalizePhone(appointment.ClientPhone) != NormalizePhone(dto.Phone))
        {
            return NotFound(new { message = "Agendamento não encontrado para este telefone." });
        }

        // Pedido ainda em análise pode ser retirado a qualquer momento; confirmado só com mais de 24 h
        if (appointment.Status == AppointmentStatus.Confirmed && appointment.StartTime <= DateTime.UtcNow.AddHours(24))
        {
            return BadRequest(new { message = "Cancelamentos com menos de 24 horas de antecedência devem ser feitos pelo WhatsApp." });
        }

        appointment.Status = AppointmentStatus.Cancelled;
        await _context.SaveChangesAsync();

        return NoContent();
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

    // GET: api/appointments/available-slots?date=2026-09-27&serviceId=1&people=2
    // Devolve os horários de INÍCIO em que o atendimento inteiro (serviço x pessoas) cabe livre no expediente.
    [HttpGet("available-slots")]
    public async Task<ActionResult<IEnumerable<string>>> GetAvailableSlots([FromQuery] string date, [FromQuery] int serviceId, [FromQuery] int people = 1)
    {
        // 1. Validar e converter a string "YYYY-MM-DD"
        if (!DateTime.TryParse(date, out var parsedDate))
        {
            return BadRequest(new { message = "Formato de data inválido. Use AAAA-MM-DD." });
        }

        // 2. Buscar o serviço
        var service = await _context.Services.FindAsync(serviceId);
        if (service == null || !service.IsActive)
        {
            return BadRequest(new { message = "Serviço inválido ou inativo." });
        }

        if (people < 1 || people > MaxPeople)
        {
            return BadRequest(new { message = $"A quantidade de pessoas deve ser de 1 a {MaxPeople}." });
        }
        var totalMinutes = service.DurationMinutes * people;

        // 3. Expediente (06:00-22:00 em Brasília) convertido para UTC
        var workStartUtc = LocalToUtc(parsedDate, WorkStart);
        var workEndUtc = LocalToUtc(parsedDate, WorkEnd);

        // 4. Agendamentos e bloqueios (não cancelados) que tocam o expediente
        var existingAppointments = await _context.Appointments
            .Where(a => a.Status != AppointmentStatus.Cancelled &&
                        a.Status != AppointmentStatus.Rejected &&
                        a.StartTime < workEndUtc &&
                        a.EndTime > workStartUtc)
            .ToListAsync();

        var availableSlots = new List<string>();

        // 5. Percorrer os horários de início em blocos de 30 minutos. O atendimento ocupa
        //    [início, início + duração total] e precisa caber inteiro no expediente.
        for (var start = workStartUtc; start < workEndUtc; start = start.AddMinutes(SlotStepMinutes))
        {
            var end = start.AddMinutes(totalMinutes);
            if (end > workEndUtc) break;

            // Verifica colisão: (InicioNovo < FimExistente) E (FimNovo > InicioExistente)
            bool isBusy = existingAppointments.Any(a =>
                start < a.EndTime && end > a.StartTime);

            if (!isBusy)
            {
                // Retorna em horário local de Brasília
                availableSlots.Add(TimeZoneInfo.ConvertTimeFromUtc(start, BrazilTz).ToString("HH:mm"));
            }
        }

        return Ok(availableSlots);
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
            .AnyAsync(a => a.Status != AppointmentStatus.Cancelled &&
                           a.Status != AppointmentStatus.Rejected &&
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