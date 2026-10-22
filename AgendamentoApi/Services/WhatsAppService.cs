using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using AgendamentoApi.Models;

namespace AgendamentoApi.Services;

/// <summary>
/// Envia as mensagens pela WhatsApp Cloud API oficial da Meta, usando modelos (templates) aprovados.
/// Sem WhatsApp:PhoneNumberId e WhatsApp:AccessToken, só registra no log (testes locais).
/// Os textos dos modelos ficam em deploy/whatsapp-templates.md e precisam estar aprovados na Meta.
/// </summary>
public partial class WhatsAppService : IWhatsAppService
{
    private const string Language = "pt_BR";

    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<WhatsAppService> _logger;

    public WhatsAppService(HttpClient httpClient, IConfiguration configuration, ILogger<WhatsAppService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public Task SendRequestReceivedAsync(string clientPhone, string clientName, string serviceName, DateTime startTime, DateTime endTime, string manageUrl) =>
        SendTemplateAsync(clientPhone, "pedido_recebido",
            clientName, serviceName, $"{startTime:dd/MM/yyyy}", $"{startTime:HH:mm}", $"{endTime:HH:mm}",
            $"{AppointmentStatus.PendingExpiration.TotalDays:0}", manageUrl);

    public Task SendConfirmationMessageAsync(string clientPhone, string clientName, string serviceName, DateTime startTime, DateTime endTime, decimal depositAmount, string? pixCode, string manageUrl) =>
        SendTemplateAsync(clientPhone, "agendamento_confirmado",
            clientName, serviceName, $"{startTime:dd/MM/yyyy}", $"{startTime:HH:mm}", $"{endTime:HH:mm}",
            depositAmount.ToString("C2", new System.Globalization.CultureInfo("pt-BR")),
            pixCode ?? "A chave PIX será enviada por aqui", manageUrl);

    public Task SendRejectionMessageAsync(string clientPhone, string clientName, string serviceName, DateTime startTime, string? reason) =>
        SendTemplateAsync(clientPhone, "pedido_recusado",
            clientName, serviceName, $"{startTime:dd/MM/yyyy}", $"{startTime:HH:mm}",
            string.IsNullOrWhiteSpace(reason) ? "horário indisponível" : reason);

    public Task SendExpiredMessageAsync(string clientPhone, string clientName, string serviceName, DateTime startTime) =>
        SendTemplateAsync(clientPhone, "pedido_expirado",
            clientName, serviceName, $"{startTime:dd/MM/yyyy}", $"{startTime:HH:mm}");

    /// <summary>A Meta recusa parâmetros vazios, com quebra de linha, tab ou 4+ espaços seguidos.</summary>
    internal static string SanitizeParameter(string value)
    {
        var clean = SpacesRegex().Replace(value.Trim(), " ");
        return clean.Length == 0 ? "-" : clean.Length > 200 ? clean[..200] : clean;
    }

    internal static string BuildPayload(string cleanPhone, string template, IReadOnlyList<string> parameters) =>
        JsonSerializer.Serialize(new
        {
            messaging_product = "whatsapp",
            to = cleanPhone,
            type = "template",
            template = new
            {
                name = template,
                language = new { code = Language },
                components = new[]
                {
                    new
                    {
                        type = "body",
                        parameters = parameters.Select(p => new { type = "text", text = SanitizeParameter(p) }).ToArray()
                    }
                }
            }
        });

    private async Task SendTemplateAsync(string phone, string template, params string[] parameters)
    {
        var phoneNumberId = _configuration["WhatsApp:PhoneNumberId"];
        var accessToken = _configuration["WhatsApp:AccessToken"];
        var apiVersion = _configuration["WhatsApp:ApiVersion"] ?? "v21.0";

        // Só números, com DDI (a Cloud API não aceita +, espaços ou traços)
        var cleanPhone = new string(phone.Where(char.IsDigit).ToArray());
        if (cleanPhone.Length is 10 or 11) cleanPhone = "55" + cleanPhone;

        var payload = BuildPayload(cleanPhone, template, parameters);

        if (string.IsNullOrEmpty(phoneNumberId) || string.IsNullOrEmpty(accessToken))
        {
            _logger.LogInformation("\n[SIMULAÇÃO WHATSAPP] Para: {Phone}\nModelo: {Template}\n{Payload}\n", cleanPhone, template, payload);
            return;
        }

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Post, $"https://graph.facebook.com/{apiVersion}/{phoneNumberId}/messages")
            {
                Content = new StringContent(payload, Encoding.UTF8, "application/json")
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                // O corpo da resposta traz o motivo (modelo não aprovado, número inválido...) e não tem dados sensíveis
                var body = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Falha ao enviar o modelo {Template} no WhatsApp. Status {StatusCode}: {Body}", template, (int)response.StatusCode, body);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro de comunicação com a WhatsApp Cloud API.");
        }
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex SpacesRegex();
}
