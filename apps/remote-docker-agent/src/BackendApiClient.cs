using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace RemoteDocker.Agent;

public static class BackendApiClient
{
    public static async Task<IReadOnlyList<CatalogTemplateItem>> ListTemplatesAsync(string apiBaseUrl, string jwtToken, CancellationToken ct)
    {
        using var client = new HttpClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", jwtToken);

        var response = await client.GetAsync($"{apiBaseUrl.TrimEnd('/')}/catalog/templates", ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Unable to list templates ({(int)response.StatusCode}): {body}");
        }

        using var json = JsonDocument.Parse(body);
        if (!json.RootElement.TryGetProperty("data", out var dataNode) || dataNode.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<CatalogTemplateItem>();
        }

        var result = new List<CatalogTemplateItem>();
        foreach (var node in dataNode.EnumerateArray())
        {
            var id = node.TryGetProperty("id", out var idNode) ? idNode.GetString() : null;
            var name = node.TryGetProperty("name", out var nameNode) ? nameNode.GetString() : null;
            var type = node.TryGetProperty("type", out var typeNode) ? typeNode.GetString() : null;
            var description = node.TryGetProperty("description", out var descNode) ? descNode.GetString() : null;

            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(type))
            {
                continue;
            }

            var ports = new List<CatalogTemplatePortItem>();
            if (node.TryGetProperty("ports", out var portsNode) && portsNode.ValueKind == JsonValueKind.Array)
            {
                foreach (var p in portsNode.EnumerateArray())
                {
                    var serviceName = p.TryGetProperty("serviceName", out var sn) ? sn.GetString() : "default";
                    var portName = p.TryGetProperty("name", out var nn) ? nn.GetString() : null;
                    var port = p.TryGetProperty("port", out var pn) && pn.TryGetInt32(out var val) ? val : 0;
                    if (!string.IsNullOrWhiteSpace(portName) && port > 0)
                    {
                        ports.Add(new CatalogTemplatePortItem(serviceName ?? "default", portName, port));
                    }
                }
            }

            var volumes = new List<CatalogTemplateVolumeItem>();
            if (node.TryGetProperty("volumes", out var volumesNode) && volumesNode.ValueKind == JsonValueKind.Array)
            {
                foreach (var v in volumesNode.EnumerateArray())
                {
                    var serviceName = v.TryGetProperty("serviceName", out var sn) ? sn.GetString() : "default";
                    var volumeName = v.TryGetProperty("name", out var nn) ? nn.GetString() : null;
                    var mountPath = v.TryGetProperty("mountPath", out var mp) ? mp.GetString() : null;
                    var mode = v.TryGetProperty("mode", out var mo) ? mo.GetString() : "REMOTE_ONLY";
                    var conflict = v.TryGetProperty("defaultConflictPolicy", out var cp) ? cp.GetString() : "PREFER_REMOTE";

                    if (!string.IsNullOrWhiteSpace(volumeName) && !string.IsNullOrWhiteSpace(mountPath))
                    {
                        volumes.Add(new CatalogTemplateVolumeItem(serviceName ?? "default", volumeName, mountPath, mode ?? "REMOTE_ONLY", conflict ?? "PREFER_REMOTE"));
                    }
                }
            }

            result.Add(new CatalogTemplateItem(id, name, type, description, ports, volumes));
        }

        return result;
    }

    public static async Task<string> CreateInstanceAsync(
        string apiBaseUrl,
        string jwtToken,
        string templateId,
        string instanceName,
        IReadOnlyList<VolumeOverrideRequest> volumeOverrides,
        CancellationToken ct)
    {
        using var client = new HttpClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", jwtToken);

        var payload = new
        {
            templateId,
            name = instanceName,
            volumeOverrides = volumeOverrides.Select(v => new
            {
                name = v.Name,
                localPath = v.LocalPath,
                mode = v.Mode,
                conflictPolicy = v.ConflictPolicy
            }).ToArray()
        };

        var response = await client.PostAsJsonAsync($"{apiBaseUrl.TrimEnd('/')}/instances", payload, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Unable to create instance ({(int)response.StatusCode}): {body}");
        }

        using var json = JsonDocument.Parse(body);
        if (!json.RootElement.TryGetProperty("data", out var dataNode) ||
            !dataNode.TryGetProperty("id", out var idNode) ||
            string.IsNullOrWhiteSpace(idNode.GetString()))
        {
            throw new InvalidOperationException("Create instance succeeded but response did not include instance id.");
        }

        return idNode.GetString()!;
    }

    public static async Task CreateForwardAsync(
        string apiBaseUrl,
        string jwtToken,
        string instanceId,
        ForwardRequest forward,
        CancellationToken ct)
    {
        using var client = new HttpClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", jwtToken);

        var payload = new
        {
            instanceId,
            serviceName = forward.ServiceName,
            portName = forward.PortName,
            localPort = forward.LocalPort
        };

        var response = await client.PostAsJsonAsync($"{apiBaseUrl.TrimEnd('/')}/forwards", payload, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Unable to create forward ({(int)response.StatusCode}): {body}");
        }
    }
}