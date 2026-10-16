using System.ComponentModel.DataAnnotations;

namespace AgendamentoApi.DTOs;

public class CreateAppointmentDto
{
    [Required(ErrorMessage = "O nome da cliente é obrigatório")]
    public string ClientName { get; set; } = string.Empty;

    [Required(ErrorMessage = "O número de telefone/WhatsApp é obrigatório")]
    public string ClientPhone { get; set; } = string.Empty;

    public string? ClientAddress { get; set; }

    // Opcional: quando informado, a taxa de deslocamento é recalculada no servidor
    public string? Cep { get; set; }

    [Required(AllowEmptyStrings = false, ErrorMessage = "A descrição do serviço é obrigatória")]
    [StringLength(1000, ErrorMessage = "A descrição pode ter no máximo 1000 caracteres")]
    public string Description { get; set; } = string.Empty;

    // Fotos de referência (máx. 5, validadas no controller)
    public List<IFormFile>? Images { get; set; }

    [Required]
    public int ServiceItemId { get; set; }

    // Horário em que a cliente precisa estar 100% pronta (fim do atendimento).
    // O início é calculado pelo servidor: ReadyTime - (duração do serviço x pessoas).
    [Required]
    public DateTimeOffset ReadyTime { get; set; }

    // Para quantas pessoas é o serviço (o valor do serviço e a duração são multiplicados; o deslocamento não)
    [Range(1, 20, ErrorMessage = "A quantidade de pessoas deve ser de 1 a 20")]
    public int People { get; set; } = 1;
}