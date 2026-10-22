namespace AgendamentoApi.Services;

public interface IDepositService
{
    /// <summary>Valor do sinal para um total (serviços + deslocamento), arredondado em centavos.</summary>
    decimal Calculate(decimal total);

    /// <summary>"PIX copia e cola" do sinal, ou null se a chave PIX não estiver configurada.</summary>
    string? BuildPixCode(int appointmentId, decimal amount);
}

/// <summary>Configuração: Deposit:Percent (padrão 30) e Pix:Key, Pix:MerchantName, Pix:MerchantCity.</summary>
public class DepositService : IDepositService
{
    private const decimal DefaultPercent = 30m;
    private readonly IConfiguration _configuration;

    public DepositService(IConfiguration configuration) => _configuration = configuration;

    public decimal Calculate(decimal total)
    {
        var percent = _configuration.GetValue<decimal?>("Deposit:Percent") ?? DefaultPercent;
        return Math.Round(total * Math.Clamp(percent, 0m, 100m) / 100m, 2, MidpointRounding.AwayFromZero);
    }

    public string? BuildPixCode(int appointmentId, decimal amount)
    {
        var key = _configuration["Pix:Key"];
        if (string.IsNullOrWhiteSpace(key) || amount <= 0) return null;
        return PixPayload.Build(
            key,
            _configuration["Pix:MerchantName"] ?? "Lari Novais Beauty",
            _configuration["Pix:MerchantCity"] ?? "Sao Paulo",
            amount,
            $"LARI{appointmentId}");
    }
}
