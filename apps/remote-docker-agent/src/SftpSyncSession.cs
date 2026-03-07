using Renci.SshNet;
using Renci.SshNet.Sftp;

namespace RemoteDocker.Agent;

public sealed class SftpSyncSession
{
    private readonly SyncSessionSpec _spec;
    private readonly CancellationTokenSource _cts = new();

    public string SyncId => _spec.SyncId;

    public SftpSyncSession(SyncSessionSpec spec)
    {
        _spec = spec;
    }

    public Task StartAsync(CancellationToken outerToken)
    {
        var linked = CancellationTokenSource.CreateLinkedTokenSource(_cts.Token, outerToken);
        return Task.Run(() => RunLoopAsync(linked.Token), linked.Token);
    }

    public void Stop()
    {
        _cts.Cancel();
    }

    private async Task RunLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                SyncOnce();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[sync:{_spec.SyncId}] {ex.Message}");
            }

            await Task.Delay(TimeSpan.FromSeconds(5), ct);
        }
    }

    private void SyncOnce()
    {
        Directory.CreateDirectory(_spec.LocalPath);

        using var client = CreateClient();
        client.Connect();

        EnsureRemoteDirectory(client, _spec.RemotePath);

        var localFiles = ScanLocalFiles(_spec.LocalPath);
        var remoteFiles = ScanRemoteFiles(client, _spec.RemotePath);

        var allKeys = new HashSet<string>(localFiles.Keys, StringComparer.OrdinalIgnoreCase);
        allKeys.UnionWith(remoteFiles.Keys);

        foreach (var key in allKeys)
        {
            localFiles.TryGetValue(key, out var local);
            remoteFiles.TryGetValue(key, out var remote);

            if (local is not null && remote is null)
            {
                Upload(client, local.FullPath, CombineRemotePath(_spec.RemotePath, key), local.LastWriteUtc);
                continue;
            }

            if (local is null && remote is not null)
            {
                Download(client, remote.FullPath, Path.Combine(_spec.LocalPath, key), remote.LastWriteUtc);
                continue;
            }

            if (local is null || remote is null)
            {
                continue;
            }

            var diff = local.LastWriteUtc - remote.LastWriteUtc;
            if (Math.Abs(diff.TotalSeconds) > 2)
            {
                if (diff.TotalSeconds > 0)
                {
                    Upload(client, local.FullPath, remote.FullPath, local.LastWriteUtc);
                }
                else
                {
                    Download(client, remote.FullPath, local.FullPath, remote.LastWriteUtc);
                }

                continue;
            }

            if (local.Length == remote.Length)
            {
                continue;
            }

            switch (_spec.Policy)
            {
                case ConflictPolicy.PreferLocal:
                    Upload(client, local.FullPath, remote.FullPath, local.LastWriteUtc);
                    break;
                case ConflictPolicy.PreferRemote:
                    Download(client, remote.FullPath, local.FullPath, remote.LastWriteUtc);
                    break;
                default:
                    DownloadConflictCopy(client, remote.FullPath, local.FullPath);
                    break;
            }
        }

        client.Disconnect();
    }

    private SftpClient CreateClient()
    {
        if (!string.IsNullOrWhiteSpace(_spec.PrivateKeyPem))
        {
            using var privateKeyStream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(_spec.PrivateKeyPem));
            var keyFile = new PrivateKeyFile(privateKeyStream);
            return new SftpClient(_spec.SshHost, _spec.SshPort, _spec.SshUsername, keyFile);
        }

        if (!string.IsNullOrWhiteSpace(_spec.SshPassword))
        {
            return new SftpClient(_spec.SshHost, _spec.SshPort, _spec.SshUsername, _spec.SshPassword);
        }

        throw new InvalidOperationException("A password or private key is required for SFTP sync.");
    }

    private static Dictionary<string, FileEntry> ScanLocalFiles(string root)
    {
        return Directory.GetFiles(root, "*", SearchOption.AllDirectories)
            .ToDictionary(
                file => ToRelativeUnixPath(root, file),
                file =>
                {
                    var info = new FileInfo(file);
                    return new FileEntry(file, info.LastWriteTimeUtc, info.Length);
                },
                StringComparer.OrdinalIgnoreCase);
    }

    private static Dictionary<string, FileEntry> ScanRemoteFiles(SftpClient client, string root)
    {
        var result = new Dictionary<string, FileEntry>(StringComparer.OrdinalIgnoreCase);
        VisitRemote(client, root, root, result);
        return result;
    }

    private static void VisitRemote(SftpClient client, string current, string root, IDictionary<string, FileEntry> output)
    {
        foreach (var entry in client.ListDirectory(current))
        {
            if (entry.Name is "." or "..")
            {
                continue;
            }

            if (entry.IsDirectory)
            {
                VisitRemote(client, entry.FullName, root, output);
                continue;
            }

            if (!entry.IsRegularFile)
            {
                continue;
            }

            var rel = entry.FullName[root.Length..].TrimStart('/');
            output[rel] = new FileEntry(entry.FullName, entry.LastWriteTimeUtc, entry.Attributes.Size);
        }
    }

    private static void Upload(SftpClient client, string localPath, string remotePath, DateTime lastWriteUtc)
    {
        EnsureRemoteDirectory(client, Path.GetDirectoryName(remotePath)?.Replace('\\', '/') ?? "/");
        using var stream = File.OpenRead(localPath);
        client.UploadFile(stream, remotePath, true);
        client.SetLastWriteTimeUtc(remotePath, lastWriteUtc);
    }

    private static void Download(SftpClient client, string remotePath, string localPath, DateTime lastWriteUtc)
    {
        var directory = Path.GetDirectoryName(localPath);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        using var stream = File.Open(localPath, FileMode.Create, FileAccess.Write, FileShare.None);
        client.DownloadFile(remotePath, stream);
        File.SetLastWriteTimeUtc(localPath, lastWriteUtc);
    }

    private static void DownloadConflictCopy(SftpClient client, string remotePath, string localPath)
    {
        var conflictPath = $"{localPath}.remote-conflict-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}";
        Download(client, remotePath, conflictPath, DateTime.UtcNow);
    }

    private static string ToRelativeUnixPath(string root, string fullPath)
    {
        var relative = Path.GetRelativePath(root, fullPath);
        return relative.Replace('\\', '/');
    }

    private static string CombineRemotePath(string root, string relative)
    {
        return $"{root.TrimEnd('/')}/{relative.TrimStart('/')}";
    }

    private static void EnsureRemoteDirectory(SftpClient client, string path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return;
        }

        var normalized = path.Replace('\\', '/');
        var parts = normalized.Split('/', StringSplitOptions.RemoveEmptyEntries);
        var current = normalized.StartsWith('/') ? "/" : string.Empty;

        foreach (var part in parts)
        {
            current = string.IsNullOrEmpty(current) || current == "/" ? $"/{part}" : $"{current}/{part}";
            if (!client.Exists(current))
            {
                client.CreateDirectory(current);
            }
        }
    }

    private sealed record FileEntry(string FullPath, DateTime LastWriteUtc, long Length);
}