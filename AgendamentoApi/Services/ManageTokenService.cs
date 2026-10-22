using System.Security.Cryptography;
using System.Text;

namespace AgendamentoApi.Services;

public interface IManageTokenService
{
    /// <summary>Código secreto do agendamento (quem tem o código vê, paga o sinal e cancela).</summary>
    string Create(int appointmentId);

    /// <summary>Id do agendamento se o código for válido; null se for adulterado ou inventado.</summary>
    int? TryGetAppointmentId(string? token);

    /// <summary>Link do site que abre "Meus agendamentos" com esse agendamento (o código vai depois do #, que o servidor nunca recebe).</summary>
    string BuildUrl(int appointmentId);
}

/// <summary>
/// O código é "id.assinatura": a assinatura é um HMAC-SHA256 do id com uma chave derivada de Jwt:Key. Como dá para
/// recalcular, nada é gravado no banco e as mensagens de WhatsApp podem sempre reenviar o mesmo link.
/// Sem a chave não dá para gerar o código de outro agendamento (128 bits de assinatura).
/// </summary>
public class ManageTokenService : IManageTokenService
{
    private const int SignatureChars = 22;
    private readonly byte[] _key;
    private readonly string _siteUrl;

    public ManageTokenService(IConfiguration configuration)
    {
        var jwtKey = configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key não configurada.");
        _key = SHA256.HashData(Encoding.UTF8.GetBytes("manage-token:" + jwtKey));
        _siteUrl = (configuration["Site:Url"] ?? "https://larinovaisbeauty.com.br").TrimEnd('/');
    }

    public string Create(int appointmentId) => $"{appointmentId}.{Sign(appointmentId)}";

    public int? TryGetAppointmentId(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var parts = token.Trim().Split('.');
        if (parts.Length != 2 || !int.TryParse(parts[0], out var id) || id <= 0) return null;

        var expected = Encoding.ASCII.GetBytes(Sign(id));
        var given = Encoding.ASCII.GetBytes(parts[1]);
        return given.Length == expected.Length && CryptographicOperations.FixedTimeEquals(expected, given) ? id : null;
    }

    public string BuildUrl(int appointmentId) => $"{_siteUrl}/#ag={Create(appointmentId)}";

    private string Sign(int id)
    {
        var mac = HMACSHA256.HashData(_key, Encoding.UTF8.GetBytes($"manage:{id}"));
        return Convert.ToBase64String(mac).Replace('+', '-').Replace('/', '_').TrimEnd('=')[..SignatureChars];
    }
}
