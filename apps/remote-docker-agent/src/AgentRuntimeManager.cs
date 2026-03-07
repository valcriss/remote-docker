namespace RemoteDocker.Agent;

public enum AgentRuntimeStatus
{
    Stopped,
    Connecting,
    Connected,
    Error
}

public sealed class AgentRuntimeManager
{
    private AgentClient? _client;
    private CancellationTokenSource? _cts;
    private Task? _runTask;

    public AgentRuntimeStatus Status { get; private set; } = AgentRuntimeStatus.Stopped;
    public string? LastError { get; private set; }

    public event Action<AgentRuntimeStatus, string?>? StatusChanged;

    public bool IsRunning => _runTask is { IsCompleted: false };

    public void Start(AgentOptions options)
    {
        Stop();

        _cts = new CancellationTokenSource();
        _client = new AgentClient(options, OnAgentStatus);
        _runTask = Task.Run(() => _client.RunAsync(_cts.Token));
    }

    public void Stop()
    {
        try
        {
            _cts?.Cancel();
            _runTask?.Wait(TimeSpan.FromSeconds(2));
        }
        catch
        {
            // best effort
        }
        finally
        {
            _cts?.Dispose();
            _cts = null;
            _runTask = null;
            SetStatus(AgentRuntimeStatus.Stopped, null);
        }
    }

    private void OnAgentStatus(AgentRuntimeStatus status, string? error)
    {
        SetStatus(status, error);
    }

    private void SetStatus(AgentRuntimeStatus status, string? error)
    {
        Status = status;
        LastError = error;
        StatusChanged?.Invoke(status, error);
    }
}