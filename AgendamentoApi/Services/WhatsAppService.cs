using System.Text;
using System.Text.Json;

namespace AgendamentoApi.Services;

public class WhatsAppService : IWhatsAppService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<WhatsAppService> _logger;

    public WhatsAppService(HttpClient httpClient, IConfiguration configuration, ILogger<WhatsAppService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendConfirmationMessageAsync(string clientPhone, string clientName, string serviceName, DateTime startTime)
    {
        var apiUrl = _configuration["WhatsApp:ApiUrl"];
        var apiKey = _configuration["WhatsApp:ApiKey"];

        // Limpa caracteres especiais do telefone (deixando apenas números)
        var cleanPhone = new string(clientPhone.Where(char.IsDigit).ToArray());

        // Mensagem formatada e profissional para a cliente
        var messageText = $"Olá {clientName}! ✨\n\n" +
                          $"O seu agendamento para *{serviceName}* foi confirmado com sucesso!\n" +
                          $"📅 Data e Hora: {startTime:dd/MM/yyyy às HH:mm}\n\n" +
                          $"Se precisar de desmarcar ou tiver alguma dúvida, por favor responda a esta mensagem. Até breve!";

        // Se ainda não tiver as credenciais preenchidas, apenas regista no log para testes locais
        if (string.IsNullOrEmpty(apiUrl))
        {
            _logger.LogInformation("\n[SIMULAÇÃO WHATSAPP] Para: {Phone}\nMensagem:\n{Msg}\n", cleanPhone, messageText);
            return;
        }

        try
        {
            var payload = new
            {
                number = cleanPhone,
                textMessage = new { text = messageText }
            };

            var jsonContent = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            var request = new HttpRequestMessage(HttpMethod.Post, apiUrl);
            request.Headers.Add("apikey", apiKey);
            request.Content = jsonContent;

            var response = await _httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Falha ao enviar mensagem de WhatsApp. Status code: {StatusCode}", response.StatusCode);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro de comunicação com a API de WhatsApp.");
        }
    }
}