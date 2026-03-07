using System.Net.Http.Json;
using System.Text.Json;

namespace RemoteDocker.Agent;

public static class AuthService
{
    public static async Task<string> LoginAsync(string apiBaseUrl, string email, string password, CancellationToken ct)
    {
        using var client = new HttpClient();
        var response = await client.PostAsJsonAsync($"{apiBaseUrl.TrimEnd('/')}/auth/login", new { email, password }, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Authentication failed ({(int)response.StatusCode}): {body}");
        }

        using var json = JsonDocument.Parse(body);
        var root = json.RootElement;
        if (!root.TryGetProperty("data", out var data) || !data.TryGetProperty("token", out var tokenNode))
        {
            throw new InvalidOperationException("Backend response does not contain data.token.");
        }

        return tokenNode.GetString() ?? throw new InvalidOperationException("Token is empty.");
    }

    public static string ComputeWsAgentUrl(string apiBaseUrl)
    {
        var uri = new Uri(apiBaseUrl.TrimEnd('/'));
        var wsScheme = uri.Scheme == "https" ? "wss" : "ws";
        var basePath = uri.AbsolutePath.TrimEnd('/');
        var host = uri.IsDefaultPort ? uri.Host : $"{uri.Host}:{uri.Port}";

        if (basePath.EndsWith("/api", StringComparison.OrdinalIgnoreCase))
        {
            basePath = basePath[..^4];
        }

        return $"{wsScheme}://{host}{basePath}/ws/agent";
    }
}