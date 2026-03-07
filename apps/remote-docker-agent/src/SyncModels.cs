namespace RemoteDocker.Agent;

public enum ConflictPolicy
{
    PreferLocal,
    PreferRemote,
    Manual
}

public sealed record SyncSessionSpec(
    string SyncId,
    string LocalPath,
    string RemotePath,
    string SshHost,
    int SshPort,
    string SshUsername,
    string? SshPassword,
    string? PrivateKeyPem,
    ConflictPolicy Policy
);