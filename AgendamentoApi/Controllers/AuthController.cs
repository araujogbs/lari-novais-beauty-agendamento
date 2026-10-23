using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace AgendamentoApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private static readonly PasswordHasher<string> Hasher = new();

    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IConfiguration configuration, ILogger<AuthController> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    [HttpPost("login")]
    [EnableRateLimiting("login")]
    public IActionResult Login([FromBody] LoginRequest request)
    {
        // Credenciais do administrador vêm da configuração (User Secrets / variáveis de ambiente).
        // Admin:PasswordHash é um hash do ASP.NET Identity, nunca a senha em texto puro.
        var adminUser = _configuration["Admin:Username"];
        var adminHash = _configuration["Admin:PasswordHash"];

        if (string.IsNullOrEmpty(adminUser) || string.IsNullOrEmpty(adminHash))
        {
            _logger.LogError("Admin:Username / Admin:PasswordHash não configurados; login desabilitado.");
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Autenticação indisponível." });
        }

        // Sempre verifica o hash (mesmo com usuário errado) para não vazar, pelo tempo de resposta, se o usuário existe
        var userMatches = CryptographicOperations.FixedTimeEquals(
            SHA256.HashData(Encoding.UTF8.GetBytes(request.Username)),
            SHA256.HashData(Encoding.UTF8.GetBytes(adminUser)));

        var passwordResult = Hasher.VerifyHashedPassword(adminUser, adminHash, request.Password);
        var passwordMatches = passwordResult != PasswordVerificationResult.Failed;

        if (userMatches && passwordMatches)
        {
            return Ok(new { token = GenerateJwtToken(adminUser, new[] { "Admin" }) });
        }

        return Unauthorized(new { message = "Credenciais inválidas" });
    }

    private string GenerateJwtToken(string username, string[] roles)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key not configured"));

        var claims = new List<Claim> { new(ClaimTypes.Name, username) };
        // Um claim por papel, para [Authorize(Roles = "...")] funcionar com mais de um papel
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            // Sessão longa para a Lari não digitar a senha a cada abertura do painel no celular (Jwt:ExpiryDays, padrão 30).
            // Um token não pode ser revogado sozinho: para derrubar todas as sessões, troque Jwt:Key.
            Expires = DateTime.UtcNow.AddDays(Math.Clamp(_configuration.GetValue<int?>("Jwt:ExpiryDays") ?? 30, 1, 90)),
            Issuer = _configuration["Jwt:Issuer"] ?? throw new InvalidOperationException("JWT Issuer not configured"),
            Audience = _configuration["Jwt:Audience"] ?? throw new InvalidOperationException("JWT Audience not configured"),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }
}

public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
