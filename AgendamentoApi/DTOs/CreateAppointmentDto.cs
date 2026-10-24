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

    // Um ou mais serviços (o valor e a duração somam)
    public List<int>? ServiceItemIds { get; set; }

    // Serviços de cada pessoa: um item por pessoa, ids separados por vírgula (ex.: "1,2" e "2").
    // Quando informado, vale no lugar de ServiceItemIds x People.
    public List<string>? PersonServices { get; set; }

    // Compatibilidade com clientes antigos que enviam um serviço só
    public int ServiceItemId { get; set; }

    // Horário de início do atendimento.
    // O término é calculado pelo servidor: StartTime + (duração do serviço x pessoas).
    [Required]
    public DateTimeOffset StartTime { get; set; }

    // Para quantas pessoas é o serviço (o valor do serviço e a duração são multiplicados; o deslocamento não)
    [Range(1, 20, ErrorMessage = "A quantidade de pessoas deve ser de 1 a 20")]
    public int People { get; set; } = 1;
}