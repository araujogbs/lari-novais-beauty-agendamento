namespace AgendamentoApi.Models;

/// <summary>Aparelho da maquiadora que recebe a notificação push de um novo pedido (token do Expo).</summary>
public class PushDevice
{
    public int Id { get; set; }
    public string Token { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
