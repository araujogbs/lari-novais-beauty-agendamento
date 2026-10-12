using System.ComponentModel.DataAnnotations;

namespace AgendamentoApi.DTOs;

public class CreateAppointmentDto
{
    [Required(ErrorMessage = "O nome da cliente é obrigatório")]
    public string ClientName { get; set; } = string.Empty;

    [Required(ErrorMessage = "O número de telefone/WhatsApp é obrigatório")]
    public string ClientPhone { get; set; } = string.Empty;

    public string ClientAddress { get; set; } = string.Empty;

    [Required]
    public int ServiceItemId { get; set; }

    [Required]
    public DateTime StartTime { get; set; }
}