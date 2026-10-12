using Google.Apis.Auth.OAuth2;
using Google.Apis.Calendar.v3;
using Google.Apis.Calendar.v3.Data;
using Google.Apis.Services;

namespace AgendamentoApi.Services;

public class GoogleCalendarService : IGoogleCalendarService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<GoogleCalendarService> _logger;

    public GoogleCalendarService(IConfiguration configuration, ILogger<GoogleCalendarService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<string?> CreateEventAsync(string title, string description, DateTime startTime, DateTime endTime)
    {
        var credentialsPath = _configuration["GoogleCalendar:CredentialsJsonPath"];
        var calendarId = _configuration["GoogleCalendar:CalendarId"];

        // Se ainda não tiver o arquivo .json configurado, simula no log sem quebrar a API
        if (string.IsNullOrEmpty(credentialsPath) || !File.Exists(credentialsPath))
        {
            _logger.LogInformation("\n[SIMULAÇÃO GOOGLE CALENDAR] Evento: {Title}\nHorário: {Start:dd/MM/yyyy HH:mm} até {End:HH:mm}\nDescrição: {Desc}\n",
                title, startTime, endTime, description);
            return "simulated-event-id";
        }

        try
        {
            GoogleCredential credential;
            using (var stream = new FileStream(credentialsPath, FileMode.Open, FileAccess.Read))
            {
                credential = GoogleCredential.FromStream(stream)
                    .CreateScoped(CalendarService.Scope.Calendar);
            }

            var service = new CalendarService(new BaseClientService.Initializer()
            {
                HttpClientInitializer = credential,
                ApplicationName = "Agendamento Maquiagem",
            });

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

            var request = service.Events.Insert(newEvent, calendarId);
            var createdEvent = await request.ExecuteAsync();

            _logger.LogInformation("Evento criado no Google Calendar com ID: {EventId}", createdEvent.Id);
            return createdEvent.Id;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar evento na agenda do Google.");
            return null;
        }
    }
}