namespace AgendamentoApi.Services;

public interface IWhatsAppService
{
    Task SendConfirmationMessageAsync(string clientPhone, string clientName, string serviceName, DateTime startTime);
}

