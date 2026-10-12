namespace AgendamentoApi.Models;

public class Appointment
{
    public int Id { get; set; }

    // Dados da cliente
    public string ClientName { get; set; } = string.Empty;
    public string ClientPhone { get; set; } = string.Empty; // WhatsApp para confirmação

    public string ClientAddress { get; set; } = string.Empty;

    // Chave estrangeira para o serviço
    public int ServiceItemId { get; set; }
    public ServiceItem? ServiceItem { get; set; } // Propriedade de navegação do EF Core

    // Horários do atendimento
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }

    // Estado do agendamento (ex: "Confirmado", "Cancelado")
    public string Status { get; set; } = "Confirmed";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}