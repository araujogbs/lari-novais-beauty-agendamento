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

    public Task SendRequestReceivedAsync(string clientPhone, string clientName, string serviceName, DateTime startTime, DateTime endTime) =>
        SendAsync(clientPhone,
            $"Olá {clientName}! ✨\n\n" +
            $"Recebemos o seu pedido de agendamento para *{serviceName}*.\n" +
            $"📅 Data: {startTime:dd/MM/yyyy}\n" +
            $"🕘 Início: {startTime:HH:mm} • término previsto: {endTime:HH:mm}\n\n" +
            "Ele está *em análise*. Assim que for confirmado, você recebe uma nova mensagem por aqui. Obrigada!");

    public Task SendConfirmationMessageAsync(string clientPhone, string clientName, string serviceName, DateTime startTime, DateTime endTime) =>
        SendAsync(clientPhone,
            $"Olá {clientName}! ✨\n\n" +
            $"O seu agendamento para *{serviceName}* está *confirmado*!\n" +
            $"📅 Data: {startTime:dd/MM/yyyy}\n" +
            $"🕘 Início do atendimento: {startTime:HH:mm}\n" +
            $"✅ Término previsto: {endTime:HH:mm}\n\n" +
            "Para ver ou cancelar (com mais de 24 h de antecedência), use \"Meus agendamentos\" no site ou no app. " +
            "Com menos de 24 h, é só responder esta mensagem. Até breve!");

    public Task SendRejectionMessageAsync(string clientPhone, string clientName, string serviceName, DateTime startTime, string? reason) =>
        SendAsync(clientPhone,
            $"Olá {clientName}!\n\n" +
            $"Infelizmente não vou conseguir atender o seu pedido de *{serviceName}* em {startTime:dd/MM/yyyy} às {startTime:HH:mm}." +
            (string.IsNullOrWhiteSpace(reason) ? "" : $"\nMotivo: {reason.Trim()}") +
            "\n\nSe quiser, responda esta mensagem para combinarmos outro horário. 💕");

    public Task NotifyOwnerNewRequestAsync(string clientName, string clientPhone, string serviceName, DateTime startTime, DateTime endTime)
    {
        var ownerPhone = _configuration["WhatsApp:OwnerPhone"];
        if (string.IsNullOrWhiteSpace(ownerPhone))
        {
            _logger.LogInformation("[WHATSAPP] Novo pedido de {Client} sem aviso à maquiadora (WhatsApp:OwnerPhone não configurado).", clientName);
            return Task.CompletedTask;
        }

        return SendAsync(ownerPhone,
            "🔔 Novo pedido de agendamento para analisar\n\n" +
            $"Cliente: {clientName} ({clientPhone})\n" +
            $"Serviço: {serviceName}\n" +
            $"📅 {startTime:dd/MM/yyyy}, das {startTime:HH:mm} às {endTime:HH:mm}\n\n" +
            "Aprove ou recuse pelo Painel Ateliê no app.");
    }

    private async Task SendAsync(string phone, string messageText)
    {
        var apiUrl = _configuration["WhatsApp:ApiUrl"];
        var apiKey = _configuration["WhatsApp:ApiKey"];

        // Limpa caracteres especiais do telefone (deixando apenas números)
        var cleanPhone = new string(phone.Where(char.IsDigit).ToArray());

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

            var request = new HttpRequestMessage(HttpMethod.Post, apiUrl)
            {
                Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
            };
            request.Headers.Add("apikey", apiKey);

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
