namespace AgendamentoApi.Services;

public interface IGoogleCalendarService
{
    Task<string?> CreateEventAsync(string title, string description, DateTime startTime, DateTime endTime);
}