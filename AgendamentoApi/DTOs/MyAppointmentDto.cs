using System.ComponentModel.DataAnnotations;

namespace AgendamentoApi.DTOs;

// Resposta enxuta para a cliente consultar os próprios agendamentos
public class MyAppointmentDto
{
    public int Id { get; set; }
    public string ServiceName { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string? ClientAddress { get; set; }
    public decimal? TravelFee { get; set; }
    public double? DistanceKm { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class ClientCancelDto
{
    [Required(ErrorMessage = "Informe o telefone usado no agendamento")]
    public string Phone { get; set; } = string.Empty;
}
