using Google.Apis.Auth.OAuth2;
using Google.Apis.Calendar.v3;
using Google.Apis.Calendar.v3.Data;
using Google.Apis.Services;

namespace AgendamentoApi.Services;

/// <summary>
/// Eventos na agenda da maquiadora, por uma conta de serviço do Google com permissão de editar
/// a agenda (GoogleCalendar:CredentialsJsonPath e GoogleCalendar:CalendarId). Sem o arquivo de
/// credenciais, só registra no log (simulação). Falhas do Google nunca derrubam o pedido.
/// </summary>
public class GoogleCalendarService : IGoogleCalendarService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<GoogleCalendarService> _logger;

    public GoogleCalendarService(IConfiguration configuration, ILogger<GoogleCalendarService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    // null quando ainda não está configurado
    private (CalendarService Service, string CalendarId)? Connect()
    {
        var credentialsPath = _configuration["GoogleCalendar:CredentialsJsonPath"];
        var calendarId = _configuration["GoogleCalendar:CalendarId"];
        if (string.IsNullOrEmpty(credentialsPath) || !File.Exists(credentialsPath) || string.IsNullOrEmpty(calendarId))
            return null;

        var credential = CredentialFactory.FromFile<ServiceAccountCredential>(credentialsPath)
            .ToGoogleCredential()
            .CreateScoped(CalendarService.Scope.CalendarEvents);

        var service = new CalendarService(new BaseClientService.Initializer()
        {
            HttpClientInitializer = credential,
            ApplicationName = "Agendamento Lari Novais Beauty",
        });
        return (service, calendarId);
    }

    public async Task<string?> CreateEventAsync(string title, string description, DateTime startTime, DateTime endTime)
    {
        try
        {
            var google = Connect();
            if (google == null)
            {
                _logger.LogInformation("\n[SIMULAÇÃO GOOGLE CALENDAR] Evento: {Title}\nHorário: {Start:dd/MM/yyyy HH:mm} até {End:HH:mm}\nDescrição: {Desc}\n",
                    title, startTime, endTime, description);
                return null;
            }

            var newEvent = new Event()
            {
                Summary = title,
                Description = description,
                Start = new EventDateTime()
                {
                    DateTimeDateTimeOffset = startTime,
                    TimeZone = "America/Sao_Paulo",
                },
                End = new EventDateTime()
                {
                    DateTimeDateTimeOffset = endTime,
                    TimeZone = "America/Sao_Paulo",
                }
            };

            var createdEvent = await google.Value.Service.Events.Insert(newEvent, google.Value.CalendarId).ExecuteAsync();

            _logger.LogInformation("Evento criado no Google Calendar com ID: {EventId}", createdEvent.Id);
            return createdEvent.Id;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar evento na agenda do Google.");
            return null;
        }
    }

    public async Task DeleteEventAsync(string eventId)
    {
        try
        {
            var google = Connect();
            if (google == null)
            {
                _logger.LogInformation("[SIMULAÇÃO GOOGLE CALENDAR] Evento {EventId} removido.", eventId);
                return;
            }

            await google.Value.Service.Events.Delete(google.Value.CalendarId, eventId).ExecuteAsync();
            _logger.LogInformation("Evento {EventId} removido do Google Calendar.", eventId);
        }
        catch (Exception ex)
        {
            // Já apagado à mão na agenda, por exemplo
            _logger.LogWarning(ex, "Não foi possível remover o evento {EventId} da agenda do Google.", eventId);
        }
    }
}
