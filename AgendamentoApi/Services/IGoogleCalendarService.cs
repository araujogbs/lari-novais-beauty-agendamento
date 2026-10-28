namespace AgendamentoApi.Services;

public interface IGoogleCalendarService
{
    // Devolve o id do evento criado, ou null em simulação ou erro
    Task<string?> CreateEventAsync(string title, string description, DateTime startTime, DateTime endTime);

    Task DeleteEventAsync(string eventId);
}
