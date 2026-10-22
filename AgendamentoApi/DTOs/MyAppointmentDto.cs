using System.ComponentModel.DataAnnotations;

namespace AgendamentoApi.DTOs;

// Resposta enxuta para a cliente consultar os próprios agendamentos
public class MyAppointmentDto
{
    public int Id { get; set; }
    public string ServiceName { get; set; } = string.Empty;
    // Valor total do serviço (preço unitário x pessoas), sem o deslocamento
    public decimal Price { get; set; }
    public int People { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string? ClientAddress { get; set; }
    public decimal? TravelFee { get; set; }
    public double? DistanceKm { get; set; }
    public string Status { get; set; } = string.Empty;
    // Sinal para garantir o horário (só depois que a maquiadora confirma o pedido)
    public decimal? DepositAmount { get; set; }
    public bool DepositPaid { get; set; }
    // "PIX copia e cola" do sinal; null se já foi pago ou se a chave PIX não está configurada
    public string? PixCode { get; set; }
}

public class ClientCancelDto
{
    [Required(ErrorMessage = "Informe o telefone usado no agendamento")]
    public string Phone { get; set; } = string.Empty;
}
