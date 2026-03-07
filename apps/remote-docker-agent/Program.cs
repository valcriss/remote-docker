using System.Windows.Forms;
using RemoteDocker.Agent;

namespace RemoteDocker.Agent;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();

        var (options, path) = AgentConfigStore.Load();
        Application.Run(new TrayApplicationContext(options, path));
    }
}