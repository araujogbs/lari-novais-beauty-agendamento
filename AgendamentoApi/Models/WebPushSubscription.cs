namespace AgendamentoApi.Models;

/// <summary>Navegador da maquiadora (ex.: o painel na Tela de Início do iPhone) que recebe o aviso de pedido novo por Web Push.</summary>
public class WebPushSubscription
{
    public int Id { get; set; }
    /// <summary>Endereço do serviço de push do navegador (Apple, Google, Mozilla...). É único por navegador.</summary>
    public string Endpoint { get; set; } = string.Empty;
    public string P256dh { get; set; } = string.Empty;
    public string Auth { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
