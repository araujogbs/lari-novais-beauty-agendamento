namespace AgendamentoApi.Models;

public class ServiceItem
{
    // Em C#, 'Id' com tipo int ou Guid vira chave primária (PRIMARY KEY) automaticamente
    public int Id { get; set; }

    // Nome do serviço (ex: "Maquiagem Social", "Noiva VIP")
    public string Name { get; set; } = string.Empty;

    // Duração do atendimento em minutos (ex: 60, 90)
    public int DurationMinutes { get; set; }

    // Preço do serviço (em C#, dinheiro sempre usa 'decimal' para não ter erro de precisão)
    public decimal Price { get; set; }

    // Flag para desativar um serviço sem apagar o histórico do banco
    public bool IsActive { get; set; } = true;
}