using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AgendamentoApi.Data;
using AgendamentoApi.DTOs;
using AgendamentoApi.Models;
using AgendamentoApi.Services; // Adicione este namespace

namespace AgendamentoApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AppointmentsController : ControllerBase
{
private readonly AppDbContext _context;
    private readonly IWhatsAppService _whatsAppService;
    private readonly IGoogleCalendarService _calendarService; // Novo campo

    public AppointmentsController(
        AppDbContext context, 
        IWhatsAppService whatsAppService,
        IGoogleCalendarService calendarService) // Injetado aqui
    {
        _context = context;
        _whatsAppService = whatsAppService;
        _calendarService = calendarService;
    }

    // GET: api/appointments?date=2026-10-01 (Lista agendamentos de uma data específica)
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Appointment>>> GetAppointments([FromQuery] DateTime? date)
    {
        var query = _context.Appointments
            .Include(a => a.ServiceItem) // Junta com a tabela Services (JOIN)
            .AsQueryable();

        if (date.HasValue)
        {
            var targetDate = DateTime.SpecifyKind(date.Value.Date, DateTimeKind.Utc);
            query = query.Where(a => a.StartTime.Date == targetDate);
        }

        var list = await query.OrderBy(a => a.StartTime).ToListAsync();
        return Ok(list);
    }

    // POST: api/appointments (Efetua a marcação validando conflitos)
    [HttpPost]
    public async Task<ActionResult<Appointment>> CreateAppointment(CreateAppointmentDto dto)
    {
        // 1. Procurar o serviço para validar a duração
        var service = await _context.Services.FindAsync(dto.ServiceItemId);
        if (service == null || !service.IsActive)
        {
            return BadRequest(new { message = "Serviço inválido ou inativo." });
        }

        // 2. Calcular o término previsto
        var startTimeUtc = DateTime.SpecifyKind(dto.StartTime, DateTimeKind.Utc);
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

        // 4. Gravar o agendamento
var appointment = new Appointment
        {
            ClientName = dto.ClientName,
            ClientPhone = dto.ClientPhone,
            ClientAddress = dto.ClientAddress, // <-- Adicione esta linha
            ServiceItemId = dto.ServiceItemId,
            StartTime = startTimeUtc,
            EndTime = endTimeUtc,
            Status = "Confirmed"
        };
_context.Appointments.Add(appointment);
        await _context.SaveChangesAsync();

// 1. Notificação WhatsApp
        await _whatsAppService.SendConfirmationMessageAsync(
            appointment.ClientName,
            appointment.ClientPhone,
            service.Name,
            appointment.StartTime
        );

        // 2. Criação automática no Google Calendar
 var eventTitle = $"{service.Name} - {appointment.ClientName}";
        var eventDescription = $"Cliente: {appointment.ClientName}\nWhatsApp: {appointment.ClientPhone}\nEndereço: {appointment.ClientAddress}\nValor: R$ {service.Price:F2}";
        
        await _calendarService.CreateEventAsync(
            eventTitle,
            eventDescription,
            appointment.StartTime,
            appointment.EndTime
        );
        return CreatedAtAction(nameof(GetAppointments), new { id = appointment.Id }, appointment);
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

        // 3. Montar a janela de início e fim do dia em UTC
        var dayStart = DateTime.SpecifyKind(new DateTime(parsedDate.Year, parsedDate.Month, parsedDate.Day, 0, 0, 0), DateTimeKind.Utc);
        var dayEnd = dayStart.AddDays(1);

        // 4. Buscar apenas os agendamentos daquele dia
        var existingAppointments = await _context.Appointments
            .Where(a => a.Status != "Cancelled" &&
                        a.StartTime >= dayStart &&
                        a.StartTime < dayEnd)
            .ToListAsync();

        // 5. Horário de expediente: das 09:00 às 18:00
        var workStart = DateTime.SpecifyKind(new DateTime(parsedDate.Year, parsedDate.Month, parsedDate.Day, 9, 0, 0), DateTimeKind.Utc);
        var workEnd = DateTime.SpecifyKind(new DateTime(parsedDate.Year, parsedDate.Month, parsedDate.Day, 18, 0, 0), DateTimeKind.Utc);

        var availableSlots = new List<string>();
        var currentSlot = workStart;

        // 6. Percorrer em blocos de 30 minutos
        while (currentSlot.AddMinutes(service.DurationMinutes) <= workEnd)
        {
            var potentialEnd = currentSlot.AddMinutes(service.DurationMinutes);

            // Verifica colisão: (InicioNovo < FimExistente) E (FimNovo > InicioExistente)
            bool isBusy = existingAppointments.Any(a =>
                currentSlot < a.EndTime && potentialEnd > a.StartTime);

            if (!isBusy)
            {
                availableSlots.Add(currentSlot.ToString("HH:mm"));
            }

            currentSlot = currentSlot.AddMinutes(30);
        }

        return Ok(availableSlots);
    }

// PATCH: api/appointments/5/status
    [HttpPatch("{id}/status")]
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

}