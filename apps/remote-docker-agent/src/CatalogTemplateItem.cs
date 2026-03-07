namespace RemoteDocker.Agent;

public sealed record CatalogTemplatePortItem(string ServiceName, string Name, int Port);
public sealed record CatalogTemplateVolumeItem(string ServiceName, string Name, string MountPath, string Mode, string DefaultConflictPolicy);

public sealed record CatalogTemplateItem(
    string Id,
    string Name,
    string Type,
    string? Description,
    IReadOnlyList<CatalogTemplatePortItem> Ports,
    IReadOnlyList<CatalogTemplateVolumeItem> Volumes
);

public sealed record VolumeOverrideRequest(string Name, string? LocalPath, string Mode, string ConflictPolicy);
public sealed record ForwardRequest(string ServiceName, string PortName, int LocalPort);