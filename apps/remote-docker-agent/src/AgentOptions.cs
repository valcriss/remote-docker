namespace RemoteDocker.Agent;

public sealed class AgentOptions
{
    public string BackendWsUrl { get; set; } = "ws://localhost:4000/ws/agent";
    public string BackendApiUrl { get; set; } = "http://localhost:4000/api";
    public string JwtToken { get; set; } = string.Empty;
    public string AgentVersion { get; set; } = "0.1.0";
}