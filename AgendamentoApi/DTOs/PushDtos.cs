using System.ComponentModel.DataAnnotations;

namespace AgendamentoApi.DTOs;

public class PushTokenDto
{
    [Required, StringLength(200)]
    public string Token { get; set; } = string.Empty;
}

public class WebPushKeysDto
{
    [Required, StringLength(200)]
    public string P256dh { get; set; } = string.Empty;

    [Required, StringLength(200)]
    public string Auth { get; set; } = string.Empty;
}

public class WebPushSubscribeDto
{
    [Required, StringLength(1000)]
    public string Endpoint { get; set; } = string.Empty;

    [Required]
    public WebPushKeysDto Keys { get; set; } = new();
}

public class WebPushUnsubscribeDto
{
    [Required, StringLength(1000)]
    public string Endpoint { get; set; } = string.Empty;
}
