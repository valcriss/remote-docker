using System.Net;
using System.Net.Sockets;

namespace RemoteDocker.Agent;

public sealed class LocalForwardProxy
{
    private readonly CancellationTokenSource _cts = new();
    private readonly TcpListener _listener;
    private readonly string _remoteHost;
    private readonly int _remotePort;
    private Task? _runLoopTask;

    public int LocalPort { get; }
    public string Id { get; }

    public LocalForwardProxy(string id, int localPort, string remoteHost, int remotePort)
    {
        Id = id;
        LocalPort = localPort;
        _remoteHost = remoteHost;
        _remotePort = remotePort;
        _listener = new TcpListener(IPAddress.Loopback, localPort);
    }

    public Task StartAsync()
    {
        _listener.Start();
        _runLoopTask = Task.Run(RunLoopAsync);
        return Task.CompletedTask;
    }

    public void Stop()
    {
        _cts.Cancel();
        _listener.Stop();
    }

    private async Task RunLoopAsync()
    {
        while (!_cts.IsCancellationRequested)
        {
            TcpClient? localClient = null;
            try
            {
                localClient = await _listener.AcceptTcpClientAsync(_cts.Token);
                _ = Task.Run(() => ProxyConnectionAsync(localClient, _cts.Token));
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch
            {
                localClient?.Dispose();
            }
        }
    }

    private async Task ProxyConnectionAsync(TcpClient localClient, CancellationToken ct)
    {
        try
        {
            using var _ = localClient;
            using var remoteClient = new TcpClient();
            using var connectTimeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            connectTimeout.CancelAfter(TimeSpan.FromSeconds(5));

            Console.WriteLine($"[agent] proxy connect start id={Id} remote={_remoteHost}:{_remotePort}");
            await remoteClient.ConnectAsync(_remoteHost, _remotePort, connectTimeout.Token);
            Console.WriteLine($"[agent] proxy connect ok id={Id} remote={_remoteHost}:{_remotePort}");

            using var localStream = localClient.GetStream();
            using var remoteStream = remoteClient.GetStream();

            var upstream = localStream.CopyToAsync(remoteStream, ct);
            var downstream = remoteStream.CopyToAsync(localStream, ct);

            await Task.WhenAny(upstream, downstream);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            Console.WriteLine($"[agent] proxy connect timeout id={Id} remote={_remoteHost}:{_remotePort}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[agent] proxy connection failed id={Id} remote={_remoteHost}:{_remotePort} error={ex.Message}");
        }
    }
}
