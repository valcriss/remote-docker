using System.Collections.Concurrent;

namespace RemoteDocker.Agent;

public sealed class SyncManager
{
    private readonly ConcurrentDictionary<string, SftpSyncSession> _sessions = new();

    public async Task StartOrReplaceAsync(SyncSessionSpec spec, CancellationToken ct)
    {
        if (_sessions.TryRemove(spec.SyncId, out var existing))
        {
            existing.Stop();
        }

        var session = new SftpSyncSession(spec);
        _sessions[spec.SyncId] = session;
        _ = session.StartAsync(ct);
        await Task.CompletedTask;
    }

    public bool Stop(string syncId)
    {
        if (_sessions.TryRemove(syncId, out var session))
        {
            session.Stop();
            return true;
        }

        return false;
    }

    public void StopAll()
    {
        foreach (var key in _sessions.Keys)
        {
            if (_sessions.TryRemove(key, out var session))
            {
                session.Stop();
            }
        }
    }
}