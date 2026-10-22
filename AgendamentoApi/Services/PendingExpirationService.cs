using Microsoft.EntityFrameworkCore;
using AgendamentoApi.Data;
using AgendamentoApi.Models;

namespace AgendamentoApi.Services;

/// <summary>
/// Expira os pedidos que ficaram em análise além do prazo (AppointmentStatus.PendingExpiration)
/// ou cujo horário já passou sem resposta: o horário volta a ficar livre e a cliente é avisada.
/// Roda ao subir a API e depois a cada 30 minutos.
/// </summary>
public class PendingExpirationService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(30);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PendingExpirationService> _logger;

    public PendingExpirationService(IServiceScopeFactory scopeFactory, ILogger<PendingExpirationService> logger)
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
                await ExpireAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Banco fora do ar etc.: tenta de novo na próxima rodada, sem derrubar a API
                _logger.LogError(ex, "Falha ao expirar pedidos pendentes.");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task ExpireAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var whatsApp = scope.ServiceProvider.GetRequiredService<IWhatsAppService>();

        var now = DateTime.UtcNow;
        var createdBefore = now - AppointmentStatus.PendingExpiration;
        var expired = await db.Appointments
            .Include(a => a.ServiceItem)
            .AsNoTracking()
            .Where(a => a.Status == AppointmentStatus.Pending &&
                        (a.CreatedAt <= createdBefore || a.StartTime <= now))
            .ToListAsync(ct);

        foreach (var a in expired)
        {
            // Só expira se continuar em análise (a maquiadora pode ter respondido agora há pouco)
            var updated = await db.Appointments
                .Where(x => x.Id == a.Id && x.Status == AppointmentStatus.Pending)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, AppointmentStatus.Expired), ct);
            if (updated == 0) continue;

            _logger.LogInformation("Pedido {Id} de {Client} expirou sem resposta.", a.Id, a.ClientName);
            await whatsApp.SendExpiredMessageAsync(
                a.ClientPhone, a.ClientName, a.ServiceNames ?? a.ServiceItem?.Name ?? "Serviço", BrazilTime.FromUtc(a.StartTime));
        }
    }
}
