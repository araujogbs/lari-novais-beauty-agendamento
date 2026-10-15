using System.ComponentModel.DataAnnotations;

namespace AgendamentoApi.DTOs;

public class CreateAppointmentDto
{
    [Required(ErrorMessage = "O nome da cliente é obrigatório")]
    public string ClientName { get; set; } = string.Empty;

    [Required(ErrorMessage = "O número de telefone/WhatsApp é obrigatório")]
    public string ClientPhone { get; set; } = string.Empty;

    public string? ClientAddress { get; set; }

    [Required(AllowEmptyStrings = false, ErrorMessage = "A descrição do serviço é obrigatória")]
    [StringLength(1000, ErrorMessage = "A descrição pode ter no máximo 1000 caracteres")]
    public string Description { get; set; } = string.Empty;

    // Fotos de referência (máx. 5, validadas no controller)
    public List<IFormFile>? Images { get; set; }

    [Required]
    public int ServiceItemId { get; set; }

    [Required]
    public DateTimeOffset StartTime { get; set; }
}