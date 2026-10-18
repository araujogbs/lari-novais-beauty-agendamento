namespace AgendamentoApi.Models;

/// <summary>
/// Estados de um agendamento.
/// Pending → (maquiadora aprova) → Confirmed, ou (maquiadora recusa) → Rejected.
/// Pending sem resposta em PendingExpiration (ou cujo horário já passou) → Expired, automaticamente.
/// Pending/Confirmed → Cancelled (pela cliente ou pela maquiadora). Blocked = bloqueio de agenda.
/// Cancelled, Rejected e Expired liberam o horário; os demais ocupam (inclusive Pending, para não haver dois pedidos no mesmo horário).
/// </summary>
public static class AppointmentStatus
{
    public const string Pending = "Pending";
    public const string Confirmed = "Confirmed";
    public const string Cancelled = "Cancelled";
    public const string Rejected = "Rejected";
    public const string Expired = "Expired";
    public const string Blocked = "Blocked";

    /// <summary>Estados que não ocupam a agenda (iguais aos da constraint no_overlapping_appointments).</summary>
    public static readonly string[] FreeSlot = [Cancelled, Rejected, Expired];

    /// <summary>Prazo para a maquiadora responder um pedido antes de ele expirar.</summary>
    public static readonly TimeSpan PendingExpiration = TimeSpan.FromDays(3);
}
