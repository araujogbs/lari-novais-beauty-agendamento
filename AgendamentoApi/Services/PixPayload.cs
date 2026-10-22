using System.Globalization;
using System.Text;

namespace AgendamentoApi.Services;

/// <summary>
/// Gera o "PIX copia e cola" (BR Code estático do Banco Central) com chave, valor e identificador.
/// O pagamento cai direto na conta da chave; não há provedor de pagamento no meio.
/// </summary>
public static class PixPayload
{
    public static string Build(string key, string merchantName, string merchantCity, decimal amount, string txid)
    {
        var account = Field("00", "br.gov.bcb.pix") + Field("01", key.Trim());
        var payload =
            Field("00", "01") +
            Field("01", "11") +
            Field("26", account) +
            Field("52", "0000") +
            Field("53", "986") +
            Field("54", amount.ToString("0.00", CultureInfo.InvariantCulture)) +
            Field("58", "BR") +
            Field("59", Ascii(merchantName, 25)) +
            Field("60", Ascii(merchantCity, 15)) +
            Field("62", Field("05", Alphanumeric(txid, 25))) +
            "6304";
        return payload + Crc16(payload);
    }

    private static string Field(string id, string value) => $"{id}{value.Length:00}{value}";

    /// <summary>O BR Code só aceita ASCII: tira acentos e caracteres especiais.</summary>
    private static string Ascii(string value, int max)
    {
        var decomposed = value.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in decomposed)
        {
            if (c < 128 && (char.IsLetterOrDigit(c) || c == ' ')) sb.Append(char.ToUpperInvariant(c));
        }
        var text = sb.ToString().Trim();
        return text.Length > max ? text[..max] : text;
    }

    private static string Alphanumeric(string value, int max)
    {
        var text = new string(value.Where(c => c < 128 && char.IsLetterOrDigit(c)).ToArray());
        return text.Length == 0 ? "***" : text.Length > max ? text[..max] : text;
    }

    /// <summary>CRC16/CCITT-FALSE (polinômio 0x1021, valor inicial 0xFFFF), em 4 dígitos hexadecimais.</summary>
    internal static string Crc16(string data)
    {
        ushort crc = 0xFFFF;
        foreach (var b in Encoding.ASCII.GetBytes(data))
        {
            crc ^= (ushort)(b << 8);
            for (var i = 0; i < 8; i++)
                crc = (crc & 0x8000) != 0 ? (ushort)((crc << 1) ^ 0x1021) : (ushort)(crc << 1);
        }
        return crc.ToString("X4");
    }
}
