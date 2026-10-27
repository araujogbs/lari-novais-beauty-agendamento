using Microsoft.EntityFrameworkCore;
using AgendamentoApi.Data;
using AgendamentoApi.Models;

namespace AgendamentoApi.Services;

/// <summary>
/// Bloqueio fixo da agenda: de segunda a sábado, das 06:00 às 14:00 (Brasília), "Docente Senac".
/// Mantém um bloqueio por dia nos próximos meses (a janela de agendamento do site é de 3 meses).
/// Cada bloqueio aparece no painel como qualquer outro; se a maquiadora desbloquear um dia,
/// ele fica Cancelled e não é recriado, então aquela manhã continua livre.
/// Roda ao subir a API e depois a cada 6 horas.
/// </summary>
public class RecurringBlockService : BackgroundService
{
    public const string Label = "[BLOQUEIO] Docente Senac";
    private static readonly TimeSpan Interval = TimeSpan.FromHours(6);
    private static readonly TimeSpan BlockStart = new(6, 0, 0);
    private static readonly TimeSpan BlockEnd = new(14, 0, 0);
    private const int DaysAhead = 100;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RecurringBlockService> _logger;

    public RecurringBlockService(IServiceScopeFactory scopeFactory, ILogger<RecurringBlockService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        do
        {
            try
            {
                await EnsureBlocksAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Falha ao criar os bloqueios fixos da agenda.");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private static DateTime LocalToUtc(DateTime date, TimeSpan time) =>
        TimeZoneInfo.ConvertTimeToUtc(
            DateTime.SpecifyKind(date.Date + time, DateTimeKind.Unspecified), BrazilTime.Zone);

    private async Task EnsureBlocksAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var service = await db.Services.OrderByDescending(s => s.IsActive).ThenBy(s => s.Id).FirstOrDefaultAsync(ct);
        if (service == null) return;

        var now = DateTime.UtcNow;
        var today = BrazilTime.FromUtc(now).Date;
        var created = 0;

        for (var i = 0; i < DaysAhead; i++)
        {
            var day = today.AddDays(i);
            if (day.DayOfWeek == DayOfWeek.Sunday) continue;

            var start = LocalToUtc(day, BlockStart);
            var end = LocalToUtc(day, BlockEnd);
            if (end <= now) continue;

            // Já existe (ativo ou desbloqueado pela maquiadora): não mexe
            if (await db.Appointments.AnyAsync(a => a.ClientName == Label && a.StartTime == start, ct)) continue;

            // Algo já marcado na manhã (atendimento ou outro bloqueio): deixa como está
            if (await db.Appointments.AnyAsync(a => !AppointmentStatus.FreeSlot.Contains(a.Status) &&
                                                    start < a.EndTime && end > a.StartTime, ct)) continue;

            db.Appointments.Add(new Appointment
            {
                ClientName = Label,
                ClientPhone = "00000000000",
                ServiceItemId = service.Id,
                StartTime = start,
                EndTime = end,
                Status = AppointmentStatus.Blocked,
                CreatedAt = now
            });
            try
            {
                await db.SaveChangesAsync(ct);
                created++;
            }
            catch (DbUpdateException)
            {
                // Um pedido entrou no mesmo horário agora há pouco: pula este dia
                db.ChangeTracker.Clear();
            }
        }

        if (created > 0)
            _logger.LogInformation("{Count} bloqueios fixos (Docente Senac) criados.", created);
    }
}
