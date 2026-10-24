using System.Globalization;

namespace AgendamentoApi.Services;

/// <summary>
/// Textos que a maquiadora manda para a cliente pelo WhatsApp dela (o painel abre a conversa com a mensagem pronta).
/// Os horários chegam já no fuso de Brasília.
/// Sem emojis: o WhatsApp mostra "�" no lugar deles quando vêm no text= do link wa.me.
/// </summary>
public static class ClientMessages
{
    private static readonly CultureInfo PtBr = new("pt-BR");

    public static string Confirmation(
        string name, string service, DateTime start, DateTime end,
        decimal? depositAmount, bool depositPaid, string? pixCode, string manageUrl)
    {
        var details = $"Data: {start:dd/MM/yyyy}. Início do atendimento: {start:HH:mm}, término previsto: {end:HH:mm}.";

        if (depositPaid)
            return $"Olá {name}! Recebi o seu sinal, o seu agendamento para {service} está garantido. {details} " +
                   $"Para ver ou cancelar (com mais de 24 h de antecedência), use o seu link: {manageUrl} Até breve!";

        // O PIX (QR Code e copia e cola) fica no link ("Meus agendamentos" do site), não na mensagem
        var deposit = depositAmount is > 0
            ? $" Para garantir o horário, faça o sinal de {depositAmount.Value.ToString("C2", PtBr)} por PIX" +
              (pixCode is null ? ": vou te enviar a chave PIX por aqui. " : ". ")
            : " ";

        var linkText = depositAmount is > 0 && pixCode is not null
            ? "O QR Code e o PIX copia e cola estão no seu link, onde você também pode ver ou cancelar " +
              $"(com mais de 24 h de antecedência): {manageUrl} "
            : $"Para ver ou cancelar (com mais de 24 h de antecedência), use o seu link: {manageUrl} ";

        return $"Olá {name}! O seu agendamento para {service} está confirmado! {details}{deposit}{linkText}" +
               "Com menos de 24 h, é só responder esta mensagem. Até breve!";
    }

    public static string Rejection(string name, string service, DateTime start, string? reason)
    {
        var why = string.IsNullOrWhiteSpace(reason) ? "horário indisponível" : reason.Trim();
        return $"Olá {name}! Infelizmente não vou conseguir atender o seu pedido de {service} em {start:dd/MM/yyyy} às {start:HH:mm}. " +
               $"Motivo: {why}. Se quiser, responda esta mensagem para combinarmos outro horário.";
    }

    /// <summary>Link wa.me da cliente com a mensagem pronta (só dígitos, com DDI do Brasil se faltar).</summary>
    public static string WhatsAppUrl(string clientPhone, string text)
    {
        var phone = new string(clientPhone.Where(char.IsDigit).ToArray());
        if (phone.Length is 10 or 11) phone = "55" + phone;
        return $"https://wa.me/{phone}?text={Uri.EscapeDataString(text)}";
    }
}
