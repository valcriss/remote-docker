using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace RemoteDocker.Agent;

public sealed class AgentClient
{
    private static readonly object LogLock = new();
    private static readonly string LogPath = Path.Combine(AppContext.BaseDirectory, "agent-runtime.log");
    private readonly AgentOptions _options;
    private readonly Action<AgentRuntimeStatus, string?>? _statusChanged;
    private readonly SyncManager _syncManager = new();
    private readonly ConcurrentDictionary<string, LocalForwardProxy> _forwards = new();
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public AgentClient(AgentOptions options, Action<AgentRuntimeStatus, string?>? statusChanged = null)
    {
        _options = options;
        _statusChanged = statusChanged;
    }

    public async Task RunAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            using var ws = new ClientWebSocket();
            try
            {
                _statusChanged?.Invoke(AgentRuntimeStatus.Connecting, null);
                var target = new Uri($"{_options.BackendWsUrl}?token={Uri.EscapeDataString(_options.JwtToken)}");
                await ws.ConnectAsync(target, ct);
                _statusChanged?.Invoke(AgentRuntimeStatus.Connected, null);

                await SendJsonAsync(ws, new
                {
                    type = "HELLO",
                    payload = new
                    {
                        agentVersion = _options.AgentVersion,
                        hostname = Environment.MachineName
                    }
                }, ct);

                var heartbeatTask = StartHeartbeatAsync(ws, ct);
                await ReceiveLoopAsync(ws, ct);
                await heartbeatTask;
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[agent] websocket disconnected: {ex.Message}");
                _statusChanged?.Invoke(AgentRuntimeStatus.Error, ex.Message);
            }

            await Task.Delay(TimeSpan.FromSeconds(3), ct);
        }

        foreach (var forward in _forwards.Values)
        {
            forward.Stop();
        }

        _syncManager.StopAll();
        _statusChanged?.Invoke(AgentRuntimeStatus.Stopped, null);
    }

    private async Task ReceiveLoopAsync(ClientWebSocket ws, CancellationToken ct)
    {
        var buffer = new byte[64 * 1024];

        while (ws.State == WebSocketState.Open && !ct.IsCancellationRequested)
        {
            var builder = new StringBuilder();
            WebSocketReceiveResult result;

            do
            {
                result = await ws.ReceiveAsync(buffer, ct);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "closing", ct);
                    return;
                }

                builder.Append(Encoding.UTF8.GetString(buffer, 0, result.Count));
            }
            while (!result.EndOfMessage);

            var message = JsonSerializer.Deserialize<WsMessage>(builder.ToString(), JsonOptions);
            if (message is null)
            {
                continue;
            }

            await HandleMessageAsync(ws, message, ct);
        }
    }

    private async Task HandleMessageAsync(ClientWebSocket ws, WsMessage message, CancellationToken ct)
    {
        Log($"message type={message.Type}");
        if (message.Type == "BIND_PORT")
        {
            var id = GetString(message.Payload, "id") ?? Guid.NewGuid().ToString("N");
            var localPort = GetInt(message.Payload, "localPort");
            var remoteHostRaw = GetString(message.Payload, "remoteHost") ?? "127.0.0.1";
            var remoteHost = ResolveRemoteHost(remoteHostRaw);
            var remotePort = GetInt(message.Payload, "remotePort");
            Log($"BIND_PORT received id={id} local={localPort} remote={remoteHostRaw}:{remotePort} resolved={remoteHost}:{remotePort}");

            if (_forwards.TryGetValue(id, out var existing))
            {
                Log($"BIND_PORT already bound id={id} local={existing.LocalPort}");
                await SendJsonAsync(ws, new
                {
                    type = "ACK",
                    payload = new
                    {
                        id,
                        status = "BOUND",
                        localPort = existing.LocalPort,
                        remoteHost,
                        remotePort
                    }
                }, ct);
                return;
            }

            try
            {
                var proxy = new LocalForwardProxy(id, localPort, remoteHost, remotePort);
                await proxy.StartAsync();
                _forwards[id] = proxy;
                Log($"BIND_PORT success id={id}");

                await SendJsonAsync(ws, new
                {
                    type = "ACK",
                    payload = new
                    {
                        id,
                        status = "BOUND",
                        localPort,
                        remoteHost,
                        remotePort
                    }
                }, ct);
            }
            catch (Exception ex)
            {
                Log($"BIND_PORT failed id={id} error={ex.Message}");
                await SendJsonAsync(ws, new
                {
                    type = "ACK",
                    payload = new
                    {
                        id,
                        status = "ERROR",
                        error = ex.Message
                    }
                }, ct);
            }
            return;
        }

        if (message.Type == "UNBIND_PORT")
        {
            var id = GetString(message.Payload, "id") ?? string.Empty;
            Log($"UNBIND_PORT received id={id}");
            if (_forwards.TryRemove(id, out var proxy))
            {
                proxy.Stop();
            }

            await SendJsonAsync(ws, new { type = "ACK", payload = new { id, status = "UNBOUND" } }, ct);
            return;
        }

        if (message.Type == "SYNC_START")
        {
            var syncId = GetString(message.Payload, "syncId") ?? Guid.NewGuid().ToString("N");
            var spec = new SyncSessionSpec(
                SyncId: syncId,
                LocalPath: GetString(message.Payload, "localPath") ?? throw new InvalidOperationException("localPath missing"),
                RemotePath: GetString(message.Payload, "remotePath") ?? throw new InvalidOperationException("remotePath missing"),
                SshHost: GetString(message.Payload, "sshHost") ?? throw new InvalidOperationException("sshHost missing"),
                SshPort: GetInt(message.Payload, "sshPort", 22),
                SshUsername: GetString(message.Payload, "sshUsername") ?? throw new InvalidOperationException("sshUsername missing"),
                SshPassword: GetString(message.Payload, "sshPassword"),
                PrivateKeyPem: GetString(message.Payload, "privateKeyPem"),
                Policy: ParsePolicy(GetString(message.Payload, "conflictPolicy"))
            );

            await _syncManager.StartOrReplaceAsync(spec, ct);
            await SendJsonAsync(ws, new { type = "ACK", payload = new { id = syncId, status = "SYNC_STARTED" } }, ct);
            return;
        }

        if (message.Type == "SYNC_STOP")
        {
            var syncId = GetString(message.Payload, "syncId") ?? string.Empty;
            _syncManager.Stop(syncId);
            await SendJsonAsync(ws, new { type = "ACK", payload = new { id = syncId, status = "SYNC_STOPPED" } }, ct);
        }
    }

    private static ConflictPolicy ParsePolicy(string? value)
    {
        return value switch
        {
            "PREFER_LOCAL" => ConflictPolicy.PreferLocal,
            "MANUAL" => ConflictPolicy.Manual,
            _ => ConflictPolicy.PreferRemote
        };
    }

    private static string? GetString(JsonElement payload, string propertyName)
    {
        if (!payload.TryGetProperty(propertyName, out var value))
        {
            return null;
        }

        return value.ValueKind == JsonValueKind.String ? value.GetString() : value.ToString();
    }

    private static int GetInt(JsonElement payload, string propertyName, int fallback = 0)
    {
        if (!payload.TryGetProperty(propertyName, out var value))
        {
            return fallback;
        }

        if (value.ValueKind == JsonValueKind.Number)
        {
            return value.GetInt32();
        }

        if (value.ValueKind == JsonValueKind.String && int.TryParse(value.GetString(), out var parsed))
        {
            return parsed;
        }

        return fallback;
    }

    private static async Task StartHeartbeatAsync(ClientWebSocket ws, CancellationToken ct)
    {
        while (ws.State == WebSocketState.Open && !ct.IsCancellationRequested)
        {
            await SendJsonAsync(ws, new { type = "HEARTBEAT", payload = new { sentAt = DateTimeOffset.UtcNow } }, ct);
            await Task.Delay(TimeSpan.FromSeconds(10), ct);
        }
    }

    private static Task SendJsonAsync(ClientWebSocket ws, object payload, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(payload);
        var bytes = Encoding.UTF8.GetBytes(json);
        return ws.SendAsync(bytes, WebSocketMessageType.Text, true, ct);
    }

    private string ResolveRemoteHost(string remoteHost)
    {
        var normalized = remoteHost.Trim().ToLowerInvariant();
        if (normalized is "docker-host" or "host.docker.internal" or "localhost" or "127.0.0.1" or "::1")
        {
            try
            {
                var backend = new Uri(_options.BackendApiUrl);
                return backend.Host;
            }
            catch
            {
                return "127.0.0.1";
            }
        }

        return remoteHost;
    }

    private static void Log(string message)
    {
        var line = $"[{DateTimeOffset.Now:yyyy-MM-dd HH:mm:ss.fff}] {message}";
        try
        {
            lock (LogLock)
            {
                File.AppendAllText(LogPath, line + Environment.NewLine);
            }
        }
        catch
        {
            // best effort logging
        }
    }

    private sealed record WsMessage(
        [property: JsonPropertyName("type")] string Type,
        [property: JsonPropertyName("payload")] JsonElement Payload
    );
}
