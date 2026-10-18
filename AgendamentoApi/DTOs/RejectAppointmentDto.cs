using System.ComponentModel.DataAnnotations;

namespace AgendamentoApi.DTOs;

// Recusa de um pedido em análise; o motivo (opcional) vai na mensagem de WhatsApp para a cliente
public class RejectAppointmentDto
{
    [StringLength(300, ErrorMessage = "O motivo pode ter no máximo 300 caracteres")]
    public string? Reason { get; set; }
}
