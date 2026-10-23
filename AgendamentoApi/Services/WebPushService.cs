using System.Net;
using System.Text.Json;
using AgendamentoApi.Data;
using AgendamentoApi.Models;
using Lib.Net.Http.WebPush;
using Lib.Net.Http.WebPush.Authentication;
using Microsoft.EntityFrameworkCore;

namespace AgendamentoApi.Services;

public interface IWebPushService
{
    /// <summary>Chave pública VAPID que o navegador usa para assinar; null se o Web Push não estiver configurado.</summary>
    string? PublicKey { get; }

    /// <summary>Avisa os navegadores da maquiadora de que chegou um pedido novo. Nunca lança: falha só vai para o log.</summary>
    Task NotifyNewBookingAsync(Appointment appointment, string serviceLabel);
}

/// <summary>
/// Web Push (padrão do navegador, funciona no Safari do iPhone com o painel na Tela de Início, iOS 16.4+).
/// Usa a Lib.Net.Http.WebPush porque ela envia no formato atual (aes128gcm + "Authorization: vapid"), o único que o serviço
/// de push da Apple aceita; o pacote "WebPush" envia no formato antigo (aesgcm) e não chega no iPhone.
/// Configuração: Vapid:PublicKey, Vapid:PrivateKey e Vapid:Subject (contato: mailto: ou https://). Sem as chaves, fica desligado.
/// Assinaturas que o serviço de push diz que não existem mais (404/410) são apagadas do banco.
/// </summary>
public class WebPushService : IWebPushService
{
    private readonly HttpClient _httpClient;
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<WebPushService> _logger;

    public WebPushService(HttpClient httpClient, AppDbContext context, IConfiguration configuration, ILogger<WebPushService> logger)
    {
        _httpClient = httpClient;
        _context = context;
        _configuration = configuration;
        _logger = logger;
    }

    public string? PublicKey => NullIfBlank(_configuration["Vapid:PublicKey"]);

    private static string? NullIfBlank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    public async Task NotifyNewBookingAsync(Appointment appointment, string serviceLabel)
    {
        try
        {
            var publicKey = PublicKey;
            var privateKey = NullIfBlank(_configuration["Vapid:PrivateKey"]);
            if (publicKey is null || privateKey is null) return;

            var subscriptions = await _context.WebPushSubscriptions.ToListAsync();
            if (subscriptions.Count == 0) return;

            var subject = NullIfBlank(_configuration["Vapid:Subject"])
                          ?? NullIfBlank(_configuration["Site:Url"])
                          ?? "https://larinovaisbeauty.com.br";

            var start = BrazilTime.FromUtc(appointment.StartTime);
            var message = new PushMessage(JsonSerializer.Serialize(new
            {
                title = "Novo pedido de agendamento",
                body = $"{appointment.ClientName}: {serviceLabel}, {start:dd/MM} às {start:HH:mm}",
                url = "/#painel",
                tag = $"pedido-{appointment.Id}"
            }))
            {
                Urgency = PushMessageUrgency.High,
                TimeToLive = (int)TimeSpan.FromDays(1).TotalSeconds // pedido velho demais deixa de ser novidade
            };

            var client = new PushServiceClient(_httpClient)
            {
                DefaultAuthentication = new VapidAuthentication(publicKey, privateKey) { Subject = subject }
            };
            var gone = new List<string>();
            foreach (var s in subscriptions)
            {
                var subscription = new PushSubscription { Endpoint = s.Endpoint };
                subscription.SetKey(PushEncryptionKeyName.P256DH, s.P256dh);
                subscription.SetKey(PushEncryptionKeyName.Auth, s.Auth);
                try
                {
                    await client.RequestPushMessageDeliveryAsync(subscription, message);
                }
                catch (PushServiceClientException ex) when (ex.StatusCode is HttpStatusCode.Gone or HttpStatusCode.NotFound)
                {
                    gone.Add(s.Endpoint);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Falha ao enviar o Web Push para {Host}.", new Uri(s.Endpoint).Host);
                }
            }

            if (gone.Count > 0)
                await _context.WebPushSubscriptions.Where(s => gone.Contains(s.Endpoint)).ExecuteDeleteAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao enviar o Web Push do pedido {Id}.", appointment.Id);
        }
    }
}
