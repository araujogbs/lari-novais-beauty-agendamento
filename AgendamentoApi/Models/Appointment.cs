using System.ComponentModel.DataAnnotations.Schema;

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

    // Chave estrangeira para o serviço (o primeiro escolhido; veja ServiceItemIds para todos)
    public int ServiceItemId { get; set; }

    // Todos os serviços do pedido (o Atendimento Social aceita mais de um), com nome e valor gravados
    // no momento do pedido: mudar o preço de um serviço depois não altera pedidos antigos.
    public List<int> ServiceItemIds { get; set; } = new();
    public string? ServiceNames { get; set; }
    // Soma dos serviços x pessoas, sem o deslocamento (null só em bloqueios)
    public decimal? TotalPrice { get; set; }

    // Sinal exigido para garantir o horário: calculado ao aprovar o pedido; a maquiadora marca quando recebe
    public decimal? DepositAmount { get; set; }
    public DateTime? DepositPaidAt { get; set; }

    // Para quantas pessoas o serviço foi contratado (valor e duração são multiplicados por este número)
    public int People { get; set; } = 1;
    public ServiceItem? ServiceItem { get; set; } // Propriedade de navegação do EF Core

    // Horários do atendimento
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }

    // Estado do agendamento (veja AppointmentStatus). Nasce em análise até a maquiadora aprovar.
    public string Status { get; set; } = AppointmentStatus.Pending;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Até quando a maquiadora pode responder o pedido (só para os em análise; não é gravado no banco)
    [NotMapped]
    public DateTime? ExpiresAt => Status == AppointmentStatus.Pending ? CreatedAt + AppointmentStatus.PendingExpiration : null;
}