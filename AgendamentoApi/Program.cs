using Microsoft.EntityFrameworkCore;
using AgendamentoApi.Data;
using AgendamentoApi.Services;





var builder = WebApplication.CreateBuilder(args);

// 1. Configurar CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Configuração do PostgreSQL
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
// Regista o serviço de WhatsApp com HttpClient gerenciado pelo .NET
builder.Services.AddHttpClient<IWhatsAppService, WhatsAppService>();
// Registro dos serviços externos
builder.Services.AddHttpClient<IWhatsAppService, WhatsAppService>();
builder.Services.AddScoped<IGoogleCalendarService, GoogleCalendarService>(); // Adicione esta linha

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// 2. Ativar o CORS (deve vir antes de MapControllers)
app.UseCors("AllowAll");

app.UseAuthorization();
app.MapControllers();

app.Run();