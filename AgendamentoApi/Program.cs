using Microsoft.EntityFrameworkCore;
using AgendamentoApi.Data;
using AgendamentoApi.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Threading.RateLimiting;
var builder = WebApplication.CreateBuilder(args);

// 1. Configurar CORS
// O app mobile nativo não é afetado por CORS; isto só vale para navegadores.
// Produção: liste as origens em Cors:AllowedOrigins (ex.: Cors__AllowedOrigins__0).
// Em desenvolvimento, sem lista configurada, qualquer origem é aceita.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddPolicy("Default", policy =>
    {
        if (allowedOrigins.Length > 0)
            policy.WithOrigins(allowedOrigins).WithMethods("GET", "POST", "PATCH").WithHeaders("Authorization", "Content-Type");
        else if (builder.Environment.IsDevelopment())
            policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
        // sem origens e fora de desenvolvimento: nenhuma origem de navegador é liberada
    });
});

// Em produção a API fica atrás do Caddy (deploy/), que termina o HTTPS e repassa o IP real da cliente
// em X-Forwarded-For. Sem isto, todo mundo teria o IP do proxy e dividiria a mesma cota do rate limiting.
// A porta da API não é exposta fora da rede do Docker, então só o proxy consegue mandar esses headers.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

// Limite de requisições por IP (contra força bruta e enumeração de telefones)
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    static RateLimitPartition<string> PerIp(HttpContext ctx, int limit, TimeSpan window) =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = limit, Window = window, QueueLimit = 0 });

    options.AddPolicy("login", ctx => PerIp(ctx, 5, TimeSpan.FromMinutes(1)));
    options.AddPolicy("lookup", ctx => PerIp(ctx, 10, TimeSpan.FromMinutes(1)));
    options.AddPolicy("estimate", ctx => PerIp(ctx, 15, TimeSpan.FromMinutes(1)));
    options.AddPolicy("create", ctx => PerIp(ctx, 10, TimeSpan.FromMinutes(10)));
});

// Configuração do PostgreSQL
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

// Configuração JWT (a chave vem de User Secrets / variável de ambiente, nunca do repositório)
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
{
    throw new InvalidOperationException(
        "Jwt:Key não configurada ou com menos de 32 bytes. " +
        "Defina com 'dotnet user-secrets set \"Jwt:Key\" \"<chave>\"' ou a variável de ambiente Jwt__Key.");
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
// Registro dos serviços externos (WhatsApp com HttpClient gerenciado pelo .NET)
builder.Services.AddHttpClient<IWhatsAppService, WhatsAppService>();
builder.Services.AddHttpClient<ITravelFeeService, TravelFeeService>();
builder.Services.AddScoped<IGoogleCalendarService, GoogleCalendarService>();
builder.Services.AddSingleton<IDepositService, DepositService>();
// Expira pedidos em análise sem resposta em 3 dias (veja AppointmentStatus.PendingExpiration)
builder.Services.AddHostedService<PendingExpirationService>();

var app = builder.Build();

// No servidor (Database__MigrateOnStartup=true) aplica as migrations pendentes ao subir
if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    using var scope = app.Services.CreateScope();
    scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.Migrate();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (!app.Environment.IsDevelopment())
{
    // Precisa vir antes de tudo: o rate limiting e o redirecionamento HTTPS dependem do IP e do esquema reais
    app.UseForwardedHeaders();
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["X-Frame-Options"] = "DENY";
    await next();
});

// 2. Ativar o CORS (deve vir antes de MapControllers)
app.UseCors("Default");
app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Para monitoramento (UptimeRobot etc.)
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();