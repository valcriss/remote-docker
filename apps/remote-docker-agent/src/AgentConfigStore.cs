using System.Text.Json;

namespace RemoteDocker.Agent;

public static class AgentConfigStore
{
    public static (AgentOptions options, string path) Load()
    {
        var candidates = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "appsettings.json"),
            Path.Combine(Directory.GetCurrentDirectory(), "appsettings.json"),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "appsettings.json")
        }
        .Select(Path.GetFullPath)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToArray();

        var path = candidates.FirstOrDefault(File.Exists) ?? candidates[0];
        AgentOptions options;

        if (File.Exists(path))
        {
            options = JsonSerializer.Deserialize<AgentOptions>(File.ReadAllText(path)) ?? new AgentOptions();
        }
        else
        {
            options = new AgentOptions();
            Save(options, path);
        }

        return (options, path);
    }

    public static void Save(AgentOptions options, string path)
    {
        var json = JsonSerializer.Serialize(options, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(path, json);
    }
}