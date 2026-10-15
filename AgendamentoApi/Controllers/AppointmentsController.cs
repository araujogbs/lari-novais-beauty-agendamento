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
    private static readonly TimeSpan WorkStart = new(9, 0, 0);
    private static readonly TimeSpan WorkEnd = new(18, 0, 0);
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

    private const int MaxImages = 5;
    private const long MaxImageBytes = 5 * 1024 * 1024;
    private static readonly System.Text.RegularExpressions.Regex ImageNameRegex =
        new(@"^[a-f0-9]{32}\.(jpg|png|webp)$");

    private readonly AppDbContext _context;
    private readonly string _uploadsDir;
    private readonly IWhatsAppService _whatsAppService;
    private readonly IGoogleCalendarService _calendarService; // Novo campo

    public AppointmentsController(
        AppDbContext context,
        IWhatsAppService whatsAppService,
        IGoogleCalendarService calendarService, // Injetado aqui
        IWebHostEnvironment env)
    {
        _context = context;
        _uploadsDir = Path.Combine(env.ContentRootPath, "uploads");
        _whatsAppService = whatsAppService;
        _calendarService = calendarService;
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

        // 2. Calcular o término previsto
        var startTimeUtc = dto.StartTime.UtcDateTime;
        var endTimeUtc = startTimeUtc.AddMinutes(service.DurationMinutes);

        // 3. Regra de ouro: Verificar se existe sobreposição de horários
        // Existe sobreposição se: (InicioA < FimB) E (FimA > InicioB)
        bool hasConflict = await _context.Appointments
            .AnyAsync(a => a.Status != "Cancelled" &&
                           startTimeUtc < a.EndTime &&
                           endTimeUtc > a.StartTime);

        if (hasConflict)
        {
            return Conflict(new { message = "O horário selecionado já se encontra ocupado. Escolha outro intervalo." }); // HTTP 409
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
            ServiceItemId = dto.ServiceItemId,
            StartTime = startTimeUtc,
            EndTime = endTimeUtc,
            Status = "Confirmed"
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

    // 1. Notificação WhatsApp
        await _whatsAppService.SendConfirmationMessageAsync(
            clientPhone: appointment.ClientPhone,
            clientName: appointment.ClientName,
            serviceName: service.Name,
            startTime: appointment.StartTime
        );

        // 2. Criação automática no Google Calendar
 var eventTitle = $"{service.Name} - {appointment.ClientName}";
        var eventDescription = $"Cliente: {appointment.ClientName}\nWhatsApp: {appointment.ClientPhone}\nEndereço: {appointment.ClientAddress}\nDescrição: {appointment.Description}\nFotos de referência: {appointment.ReferenceImages.Count}\nValor: R$ {service.Price:F2}";

        await _calendarService.CreateEventAsync(
            eventTitle,
            eventDescription,
            appointment.StartTime,
            appointment.EndTime
        );
        return CreatedAtAction(nameof(GetAppointments), new { id = appointment.Id }, appointment);
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
        // sobre os futuros confirmados (conjunto pequeno).
        var now = DateTime.UtcNow;
        var future = await _context.Appointments
            .Include(a => a.ServiceItem)
            .Where(a => a.Status == "Confirmed" && a.StartTime >= now)
            .OrderBy(a => a.StartTime)
            .ToListAsync();

        var result = future
            .Where(a => NormalizePhone(a.ClientPhone) == wanted)
            .Select(a => new MyAppointmentDto
            {
                Id = a.Id,
                ServiceName = a.ServiceItem?.Name ?? "Serviço",
                Price = a.ServiceItem?.Price ?? 0,
                StartTime = a.StartTime,
                EndTime = a.EndTime,
                ClientAddress = a.ClientAddress,
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
            appointment.Status != "Confirmed" ||
            NormalizePhone(appointment.ClientPhone) != NormalizePhone(dto.Phone))
        {
            return NotFound(new { message = "Agendamento não encontrado para este telefone." });
        }

        if (appointment.StartTime <= DateTime.UtcNow.AddHours(24))
        {
            return BadRequest(new { message = "Cancelamentos com menos de 24 horas de antecedência devem ser feitos pelo WhatsApp." });
        }

        appointment.Status = "Cancelled";
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

    // GET: api/appointments/available-slots?date=2026-09-27&serviceId=1
    [HttpGet("available-slots")]
    public async Task<ActionResult<IEnumerable<string>>> GetAvailableSlots([FromQuery] string date, [FromQuery] int serviceId)
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

        // 3. Expediente (09:00-18:00 em Brasília) convertido para UTC
        var workStartUtc = LocalToUtc(parsedDate, WorkStart);
        var workEndUtc = LocalToUtc(parsedDate, WorkEnd);

        // 4. Agendamentos e bloqueios (não cancelados) que tocam o expediente
        var existingAppointments = await _context.Appointments
            .Where(a => a.Status != "Cancelled" &&
                        a.StartTime < workEndUtc &&
                        a.EndTime > workStartUtc)
            .ToListAsync();

        var availableSlots = new List<string>();
        var currentSlot = workStartUtc;

        // 5. Percorrer em blocos de 30 minutos
        while (currentSlot.AddMinutes(service.DurationMinutes) <= workEndUtc)
        {
            var potentialEnd = currentSlot.AddMinutes(service.DurationMinutes);

            // Verifica colisão: (InicioNovo < FimExistente) E (FimNovo > InicioExistente)
            bool isBusy = existingAppointments.Any(a =>
                currentSlot < a.EndTime && potentialEnd > a.StartTime);

            if (!isBusy)
            {
                // Retorna em horário local de Brasília
                availableSlots.Add(TimeZoneInfo.ConvertTimeFromUtc(currentSlot, BrazilTz).ToString("HH:mm"));
            }

            currentSlot = currentSlot.AddMinutes(30);
        }

        return Ok(availableSlots);
    }

    // PATCH: api/appointments/5/status
    [HttpPatch("{id}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] string newStatus)
    {
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
            return BadRequest(new { message = "Horário deve estar entre 09:00 e 18:00." });
        }

        // 3. Converter de Brasília para UTC
        var startDateTime = LocalToUtc(dto.Date, startTime);
        var endDateTime = LocalToUtc(dto.Date, endTime);

        // 4. Verificar conflitos com agendamentos existentes (exceto cancelados)
        bool hasConflict = await _context.Appointments
            .AnyAsync(a => a.Status != "Cancelled" &&
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
            Status = "Blocked",
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