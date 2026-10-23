using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AgendamentoApi.Data;
using AgendamentoApi.Models;
using Microsoft.EntityFrameworkCore;

namespace AgendamentoApi.Services;

public interface IPushNotificationService
{
    /// <summary>Avisa os aparelhos da maquiadora de que chegou um pedido novo. Nunca lança: falha só vai para o log.</summary>
    Task NotifyNewBookingAsync(Appointment appointment, string serviceLabel);
}

/// <summary>
/// Envia pelo serviço de push do Expo (https://exp.host), sem chave de API. Tokens que o Expo diz que não existem mais
/// (app desinstalado) são apagados do banco.
/// </summary>
public class PushNotificationService : IPushNotificationService
{
    private const string SendUrl = "https://exp.host/--/api/v2/push/send";
    private const int BatchSize = 100;

    private readonly HttpClient _httpClient;
    private readonly AppDbContext _context;
    private readonly ILogger<PushNotificationService> _logger;

    public PushNotificationService(HttpClient httpClient, AppDbContext context, ILogger<PushNotificationService> logger)
    {
        _httpClient = httpClient;
        _context = context;
        _logger = logger;
    }

    public async Task NotifyNewBookingAsync(Appointment appointment, string serviceLabel)
    {
        try
        {
            var tokens = await _context.PushDevices.Select(d => d.Token).ToListAsync();
            if (tokens.Count == 0) return;

            var start = BrazilTime.FromUtc(appointment.StartTime);
            var body = $"{appointment.ClientName}: {serviceLabel}, {start:dd/MM} às {start:HH:mm}";

            foreach (var batch in tokens.Chunk(BatchSize))
            {
                var messages = batch.Select(token => new
                {
                    to = token,
                    title = "Novo pedido de agendamento",
                    body,
                    sound = "default",
                    channelId = "pedidos",
                    priority = "high",
                    data = new { appointmentId = appointment.Id, type = "new-booking" }
                });

                var response = await _httpClient.PostAsJsonAsync(SendUrl, messages);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Falha ao enviar push. Status {StatusCode}: {Body}",
                        (int)response.StatusCode, await response.Content.ReadAsStringAsync());
                    continue;
                }

                var result = await response.Content.ReadFromJsonAsync<ExpoResponse>();
                await RemoveDeadTokensAsync(batch, result?.Data);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao enviar a notificação push do pedido {Id}.", appointment.Id);
        }
    }

    // Os tickets vêm na mesma ordem das mensagens enviadas
    private async Task RemoveDeadTokensAsync(string[] batch, List<ExpoTicket>? tickets)
    {
        if (tickets is null) return;
        var dead = batch
            .Where((_, i) => i < tickets.Count && tickets[i].Details?.Error == "DeviceNotRegistered")
            .ToList();
        if (dead.Count == 0) return;
        await _context.PushDevices.Where(d => dead.Contains(d.Token)).ExecuteDeleteAsync();
    }

    private sealed record ExpoResponse([property: JsonPropertyName("data")] List<ExpoTicket>? Data);

    private sealed record ExpoTicket(
        [property: JsonPropertyName("status")] string? Status,
        [property: JsonPropertyName("details")] ExpoTicketDetails? Details);

    private sealed record ExpoTicketDetails([property: JsonPropertyName("error")] string? Error);
}
