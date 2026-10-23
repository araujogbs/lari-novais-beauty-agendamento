namespace AgendamentoApi.Services;

/// <summary>Validação de telefone brasileiro com DDD, com ou sem máscara e com ou sem o 55 do país.</summary>
public static class PhoneNumber
{
    /// <summary>Celular: 11 dígitos, com 9 depois do DDD. Fixo: 10 dígitos, começando por 2 a 5 depois do DDD.</summary>
    public static bool IsValid(string? phone)
    {
        var d = new string((phone ?? string.Empty).Where(char.IsDigit).ToArray());
        if (d.Length is 12 or 13 && d.StartsWith("55")) d = d[2..];
        if (d.Length is not (10 or 11) || d[0] == '0') return false; // DDD de 11 a 99
        return d.Length == 11 ? d[2] == '9' : d[2] is >= '2' and <= '5';
    }
}
