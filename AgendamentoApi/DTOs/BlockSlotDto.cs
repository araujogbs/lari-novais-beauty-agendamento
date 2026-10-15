using System.ComponentModel.DataAnnotations;

namespace AgendamentoApi.DTOs;

public class BlockSlotDto
{
    [Required(ErrorMessage = "A data é obrigatória")]
    public DateTime Date { get; set; }

    public TimeSpan? StartTime { get; set; }

    public TimeSpan? EndTime { get; set; }

    public string? Reason { get; set; }
}