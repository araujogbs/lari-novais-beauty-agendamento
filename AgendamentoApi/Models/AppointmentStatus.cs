namespace AgendamentoApi.Models;

/// <summary>
/// Estados de um agendamento.
/// Pending → (maquiadora aprova) → Confirmed, ou (maquiadora recusa) → Rejected.
/// Pending/Confirmed → Cancelled (pela cliente ou pela maquiadora). Blocked = bloqueio de agenda.
/// Cancelled e Rejected liberam o horário; os demais ocupam (inclusive Pending, para não haver dois pedidos no mesmo horário).
/// </summary>
public static class AppointmentStatus
{
    public const string Pending = "Pending";
    public const string Confirmed = "Confirmed";
    public const string Cancelled = "Cancelled";
    public const string Rejected = "Rejected";
    public const string Blocked = "Blocked";
}
