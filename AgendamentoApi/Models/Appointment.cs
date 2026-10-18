namespace AgendamentoApi.Models;

public class Appointment
{
    public int Id { get; set; }

    // Dados da cliente
    public string ClientName { get; set; } = string.Empty;
    public string ClientPhone { get; set; } = string.Empty; // WhatsApp para confirmação

    public string? ClientAddress { get; set; }

    // Como a cliente quer o serviço + fotos de referência (nomes dos arquivos em uploads/)
    public string? Description { get; set; }
    // Taxa de deslocamento calculada pelo CEP no momento do agendamento
    public decimal? TravelFee { get; set; }
    public double? DistanceKm { get; set; }
    public List<string> ReferenceImages { get; set; } = new();

    // Chave estrangeira para o serviço
    public int ServiceItemId { get; set; }

    // Para quantas pessoas o serviço foi contratado (valor e duração são multiplicados por este número)
    public int People { get; set; } = 1;
    public ServiceItem? ServiceItem { get; set; } // Propriedade de navegação do EF Core

    // Horários do atendimento
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }

    // Estado do agendamento (veja AppointmentStatus). Nasce em análise até a maquiadora aprovar.
    public string Status { get; set; } = AppointmentStatus.Pending;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}