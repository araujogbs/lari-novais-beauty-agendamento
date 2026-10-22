namespace AgendamentoApi.Services;

public interface IWhatsAppService
{
    /// <summary>Para a cliente, logo após o pedido: recebemos e está em análise.</summary>
    Task SendRequestReceivedAsync(string clientPhone, string clientName, string serviceName, DateTime startTime, DateTime endTime);

    /// <summary>Para a cliente, quando a maquiadora aprova: confirmação com o valor do sinal e o PIX copia e cola.</summary>
    Task SendConfirmationMessageAsync(string clientPhone, string clientName, string serviceName, DateTime startTime, DateTime endTime, decimal depositAmount, string? pixCode);

    /// <summary>Para a cliente, quando a maquiadora recusa.</summary>
    Task SendRejectionMessageAsync(string clientPhone, string clientName, string serviceName, DateTime startTime, string? reason);

    /// <summary>Para a cliente, quando o pedido expira sem resposta (prazo de AppointmentStatus.PendingExpiration).</summary>
    Task SendExpiredMessageAsync(string clientPhone, string clientName, string serviceName, DateTime startTime);
}
