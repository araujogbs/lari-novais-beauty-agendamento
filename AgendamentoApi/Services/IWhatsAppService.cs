namespace AgendamentoApi.Services;

public interface IWhatsAppService
{
    /// <summary>Para a cliente, logo após o pedido: recebemos e está em análise.</summary>
    Task SendRequestReceivedAsync(string clientPhone, string clientName, string serviceName, DateTime startTime, DateTime endTime);

    /// <summary>Para a cliente, quando a maquiadora aprova.</summary>
    Task SendConfirmationMessageAsync(string clientPhone, string clientName, string serviceName, DateTime startTime, DateTime endTime);

    /// <summary>Para a cliente, quando a maquiadora recusa.</summary>
    Task SendRejectionMessageAsync(string clientPhone, string clientName, string serviceName, DateTime startTime, string? reason);

    /// <summary>Para a maquiadora (WhatsApp:OwnerPhone), avisando de um pedido novo para analisar.</summary>
    Task NotifyOwnerNewRequestAsync(string clientName, string clientPhone, string serviceName, DateTime startTime, DateTime endTime);
}
