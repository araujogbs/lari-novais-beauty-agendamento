using System.ComponentModel.DataAnnotations;
using AgendamentoApi.Data;
using AgendamentoApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AgendamentoApi.Controllers;

public class PushTokenDto
{
    [Required, StringLength(200)]
    public string Token { get; set; } = string.Empty;
}

/// <summary>Cadastro dos aparelhos da maquiadora que recebem notificação push de pedidos novos.</summary>
[ApiController]
[Route("api/push")]
[Authorize(Roles = "Admin")]
public class PushController : ControllerBase
{
    private readonly AppDbContext _context;

    public PushController(AppDbContext context) => _context = context;

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
