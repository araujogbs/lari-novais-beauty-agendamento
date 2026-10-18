using System.Globalization;
using System.Text.Json;

namespace AgendamentoApi.Services;

public class TravelFeeOptions
{
    // Ponto de partida da maquiadora. É dado pessoal: fica em User Secrets / variável de ambiente
    // (TravelFee__OriginLatitude, TravelFee__OriginLongitude), nunca no repositório.
    public double OriginLatitude { get; set; }
    public double OriginLongitude { get; set; }
    public bool HasOrigin => OriginLatitude != 0 || OriginLongitude != 0;
    public double FreeRadiusKm { get; set; } = 5.0;
    public decimal PricePerKm { get; set; } = 3.00m;
}

public record TravelFeeResult(string Cep, string Street, string Neighborhood, string City, double DistanceKm, decimal TravelFee);

public interface ITravelFeeService
{
    // null => CEP inexistente ou sem como localizar o endereço
    Task<TravelFeeResult?> EstimateAsync(string cep, CancellationToken ct = default);
}

public class TravelFeeService : ITravelFeeService
{
    private readonly HttpClient _http;
    private readonly TravelFeeOptions _opt;
    private readonly ILogger<TravelFeeService> _logger;

    public TravelFeeService(HttpClient http, IConfiguration config, ILogger<TravelFeeService> logger)
    {
        _http = http;
        _logger = logger;
        _opt = config.GetSection("TravelFee").Get<TravelFeeOptions>() ?? new TravelFeeOptions();
        if (!_opt.HasOrigin)
            _logger.LogWarning("TravelFee:OriginLatitude/OriginLongitude não configurados: a taxa de deslocamento não será calculada.");
    }

    public async Task<TravelFeeResult?> EstimateAsync(string cep, CancellationToken ct = default)
    {
        var digits = new string((cep ?? string.Empty).Where(char.IsDigit).ToArray());
        // Sem origem a distância sairia de (0, 0) e a taxa seria absurda; segue sem taxa, como CEP não localizado
        if (digits.Length != 8 || !_opt.HasOrigin) return null;

        string street = "", neighborhood = "", city = "", state = "";
        double? lat = null, lon = null;

        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(5));
            using var resp = await _http.GetAsync($"https://brasilapi.com.br/api/cep/v2/{digits}", cts.Token);
            if (!resp.IsSuccessStatusCode) return null;
            using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(cts.Token));
            var root = doc.RootElement;
            street = Str(root, "street");
            neighborhood = Str(root, "neighborhood");
            city = Str(root, "city");
            state = Str(root, "state");

            if (root.TryGetProperty("location", out var loc) && loc.ValueKind == JsonValueKind.Object &&
                loc.TryGetProperty("coordinates", out var c) && c.ValueKind == JsonValueKind.Object)
            {
                lat = Num(c, "latitude");
                lon = Num(c, "longitude");
            }
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            _logger.LogWarning(ex, "Falha ao consultar BrasilAPI para o CEP {Cep}", digits);
            return null;
        }

        if (lat is null || lon is null)
        {
            (lat, lon) = await GeocodeAsync(street, city, state, ct);
            if (lat is null || lon is null) return null;
        }

        var distanceKm = await RouteDistanceKmAsync(lat.Value, lon.Value, ct)
                         ?? Haversine(_opt.OriginLatitude, _opt.OriginLongitude, lat.Value, lon.Value) * 1.3;

        var fee = distanceKm <= _opt.FreeRadiusKm
            ? 0m
            : Math.Round((decimal)(distanceKm - _opt.FreeRadiusKm) * _opt.PricePerKm * 2, 2); // x2: ida e volta

        return new TravelFeeResult(digits, street, neighborhood, city, Math.Round(distanceKm, 1), fee);
    }

    private async Task<(double?, double?)> GeocodeAsync(string street, string city, string state, CancellationToken ct)
    {
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(5));
            var q = Uri.EscapeDataString($"{street}, {city}, {state}, Brazil");
            using var req = new HttpRequestMessage(HttpMethod.Get,
                $"https://nominatim.openstreetmap.org/search?format=json&limit=1&q={q}");
            req.Headers.TryAddWithoutValidation("User-Agent", "LariNovaisBeauty/1.0");
            using var resp = await _http.SendAsync(req, cts.Token);
            if (!resp.IsSuccessStatusCode) return (null, null);
            using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(cts.Token));
            if (doc.RootElement.ValueKind != JsonValueKind.Array || doc.RootElement.GetArrayLength() == 0)
                return (null, null);
            var first = doc.RootElement[0];
            return (Num(first, "lat"), Num(first, "lon"));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            _logger.LogWarning(ex, "Falha ao geocodificar via Nominatim");
            return (null, null);
        }
    }

    private async Task<double?> RouteDistanceKmAsync(double destLat, double destLon, CancellationToken ct)
    {
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(3));
            var inv = CultureInfo.InvariantCulture;
            var url = string.Create(inv,
                $"http://router.project-osrm.org/route/v1/driving/{_opt.OriginLongitude},{_opt.OriginLatitude};{destLon},{destLat}?overview=false");
            using var resp = await _http.GetAsync(url, cts.Token);
            if (!resp.IsSuccessStatusCode) return null;
            using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(cts.Token));
            var routes = doc.RootElement.GetProperty("routes");
            if (routes.GetArrayLength() == 0) return null;
            return routes[0].GetProperty("distance").GetDouble() / 1000.0;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or KeyNotFoundException or InvalidOperationException)
        {
            _logger.LogWarning(ex, "OSRM indisponível; usando Haversine");
            return null;
        }
    }

    private static double Haversine(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371.0;
        static double Rad(double d) => d * Math.PI / 180.0;
        var dLat = Rad(lat2 - lat1);
        var dLon = Rad(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(Rad(lat1)) * Math.Cos(Rad(lat2)) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private static string Str(JsonElement e, string name) =>
        e.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() ?? "" : "";

    // BrasilAPI manda número ou string; Nominatim manda string
    private static double? Num(JsonElement e, string name)
    {
        if (!e.TryGetProperty(name, out var p)) return null;
        if (p.ValueKind == JsonValueKind.Number) return p.GetDouble();
        if (p.ValueKind == JsonValueKind.String &&
            double.TryParse(p.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var v)) return v;
        return null;
    }
}
