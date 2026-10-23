using System.ComponentModel.DataAnnotations;
using AgendamentoApi.Data;
using AgendamentoApi.Models;
using AgendamentoApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgendamentoApi.Controllers;

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

/// <summary>Cadastro dos aparelhos e navegadores da maquiadora que recebem notificação push de pedidos novos.</summary>
[ApiController]
[Route("api/push")]
[Authorize(Roles = "Admin")]
public class PushController : ControllerBase
{
    // Só serviços de push de navegadores conhecidos: o servidor faz POST no endereço que o painel informa
    private static readonly string[] PushHosts =
        ["fcm.googleapis.com", "web.push.apple.com", "push.services.mozilla.com", "notify.windows.com"];

    private static bool IsKnownPushEndpoint(string endpoint) =>
        Uri.TryCreate(endpoint, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps &&
        PushHosts.Any(h => uri.Host == h || uri.Host.EndsWith("." + h));

    private readonly AppDbContext _context;
    private readonly IWebPushService _webPush;

    public PushController(AppDbContext context, IWebPushService webPush)
    {
        _context = context;
        _webPush = webPush;
    }

    // GET: api/push/web/public-key (público: é a chave pública do VAPID, que o navegador precisa para assinar)
    [HttpGet("web/public-key")]
    [AllowAnonymous]
    public IActionResult GetWebPushPublicKey() =>
        _webPush.PublicKey is { } key
            ? Ok(new { publicKey = key })
            : StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Avisos no navegador indisponíveis." });

    // POST: api/push/web/subscribe (repetir não faz mal)
    [HttpPost("web/subscribe")]
    public async Task<IActionResult> WebSubscribe([FromBody] WebPushSubscribeDto dto)
    {
        var endpoint = dto.Endpoint.Trim();
        if (!IsKnownPushEndpoint(endpoint)) return BadRequest(new { message = "Navegador não suportado para avisos." });

        var existing = await _context.WebPushSubscriptions.FirstOrDefaultAsync(s => s.Endpoint == endpoint);
        if (existing is null)
        {
            _context.WebPushSubscriptions.Add(new WebPushSubscription
            {
                Endpoint = endpoint,
                P256dh = dto.Keys.P256dh.Trim(),
                Auth = dto.Keys.Auth.Trim()
            });
        }
        else
        {
            // As chaves podem mudar quando o navegador renova a assinatura
            existing.P256dh = dto.Keys.P256dh.Trim();
            existing.Auth = dto.Keys.Auth.Trim();
        }

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Duas chamadas ao mesmo tempo: a outra já gravou, e o resultado desejado é o mesmo
        }
        return NoContent();
    }

    // POST: api/push/web/unsubscribe
    [HttpPost("web/unsubscribe")]
    public async Task<IActionResult> WebUnsubscribe([FromBody] WebPushUnsubscribeDto dto)
    {
        var endpoint = dto.Endpoint.Trim();
        await _context.WebPushSubscriptions.Where(s => s.Endpoint == endpoint).ExecuteDeleteAsync();
        return NoContent();
    }

    // Tokens do Expo têm a forma ExponentPushToken[...] (ou ExpoPushToken[...])
    private static bool IsExpoToken(string token) =>
        (token.StartsWith("ExponentPushToken[") || token.StartsWith("ExpoPushToken[")) && token.EndsWith(']');

    // POST: api/push/register (repetir não faz mal)
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] PushTokenDto dto)
    {
        var token = dto.Token.Trim();
        if (!IsExpoToken(token)) return BadRequest(new { message = "Token de notificação inválido." });

        if (!await _context.PushDevices.AnyAsync(d => d.Token == token))
        {
            _context.PushDevices.Add(new PushDevice { Token = token });
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // Duas chamadas ao mesmo tempo: a outra já gravou, e o resultado desejado é o mesmo
            }
        }
        return NoContent();
    }

    // POST: api/push/unregister (ao sair do painel, para o aparelho parar de receber)
    [HttpPost("unregister")]
    public async Task<IActionResult> Unregister([FromBody] PushTokenDto dto)
    {
        var token = dto.Token.Trim();
        await _context.PushDevices.Where(d => d.Token == token).ExecuteDeleteAsync();
        return NoContent();
    }
}
