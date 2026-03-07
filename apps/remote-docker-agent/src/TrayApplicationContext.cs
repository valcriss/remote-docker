using System.Drawing;
using System.Windows.Forms;

namespace RemoteDocker.Agent;

public sealed class TrayApplicationContext : ApplicationContext
{
    private readonly Control _uiControl;
    private readonly NotifyIcon _notifyIcon;
    private readonly ToolStripMenuItem _statusItem;
    private readonly ToolStripMenuItem _connectItem;
    private readonly ToolStripMenuItem _disconnectItem;
    private readonly ToolStripMenuItem _authItem;
    private readonly ToolStripMenuItem _instantiateItem;
    private readonly ToolStripMenuItem _quitItem;

    private readonly AgentRuntimeManager _runtime;
    private AgentOptions _options;
    private readonly string _configPath;

    public TrayApplicationContext(AgentOptions options, string configPath)
    {
        _uiControl = new Control();
        _uiControl.CreateControl();
        _options = options;
        _configPath = configPath;
        _runtime = new AgentRuntimeManager();
        _runtime.StatusChanged += OnRuntimeStatusChanged;

        _statusItem = new ToolStripMenuItem("Status: idle") { Enabled = false };
        _connectItem = new ToolStripMenuItem("Connect", null, (_, _) => ConnectIfPossible());
        _disconnectItem = new ToolStripMenuItem("Disconnect", null, (_, _) => Disconnect());
        _authItem = new ToolStripMenuItem("Authenticate", null, async (_, _) => await AuthenticateAsync());
        _instantiateItem = new ToolStripMenuItem("Instantiate from Catalog...", null, async (_, _) => await InstantiateFromCatalogAsync());
        _quitItem = new ToolStripMenuItem("Quit", null, (_, _) => ExitThread());

        var menu = new ContextMenuStrip();
        menu.Items.AddRange(new ToolStripItem[]
        {
            _statusItem,
            new ToolStripSeparator(),
            _authItem,
            _instantiateItem,
            _connectItem,
            _disconnectItem,
            new ToolStripSeparator(),
            _quitItem
        });

        _notifyIcon = new NotifyIcon
        {
            Text = "Remote Docker Agent",
            Icon = SystemIcons.Application,
            ContextMenuStrip = menu,
            Visible = true
        };

        _notifyIcon.DoubleClick += async (_, _) => await AuthenticateAsync();
        UpdateStatusText();

        if (!string.IsNullOrWhiteSpace(_options.JwtToken))
        {
            ConnectIfPossible();
        }
    }

    private async Task InstantiateFromCatalogAsync()
    {
        if (string.IsNullOrWhiteSpace(_options.JwtToken))
        {
            var answer = MessageBox.Show(
                "You are not authenticated. Do you want to authenticate now?",
                "Remote Docker Agent",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Information);

            if (answer == DialogResult.Yes)
            {
                await AuthenticateAsync();
            }

            if (string.IsNullOrWhiteSpace(_options.JwtToken))
            {
                return;
            }
        }

        try
        {
            var templates = await BackendApiClient.ListTemplatesAsync(_options.BackendApiUrl, _options.JwtToken, CancellationToken.None);
            if (templates.Count == 0)
            {
                MessageBox.Show("No template available in catalog.", "Remote Docker Agent", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            using var form = new InstantiateForm(templates);
            if (form.ShowDialog() != DialogResult.OK)
            {
                return;
            }

            var selectedTemplate = form.SelectedTemplate;
            var instanceName = form.InstanceName;

            if (selectedTemplate is null || string.IsNullOrWhiteSpace(instanceName))
            {
                MessageBox.Show("Select a template and provide an instance name.", "Remote Docker Agent", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            if (!form.TryCollectSelections(out var volumeOverrides, out var forwards, out var collectError))
            {
                MessageBox.Show(collectError, "Invalid selections", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            var instanceId = await BackendApiClient.CreateInstanceAsync(
                _options.BackendApiUrl,
                _options.JwtToken,
                selectedTemplate.Id,
                instanceName,
                volumeOverrides,
                CancellationToken.None);

            foreach (var forward in forwards)
            {
                await BackendApiClient.CreateForwardAsync(
                    _options.BackendApiUrl,
                    _options.JwtToken,
                    instanceId,
                    forward,
                    CancellationToken.None);
            }

            _notifyIcon.ShowBalloonTip(2500, "Remote Docker Agent", $"Instance '{instanceName}' created.", ToolTipIcon.Info);
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "Failed to instantiate template", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private async Task AuthenticateAsync()
    {
        using var form = new LoginForm(_options.BackendApiUrl);

        while (form.ShowDialog() == DialogResult.OK)
        {
            try
            {
                var token = await AuthService.LoginAsync(form.ApiBaseUrl, form.Email, form.Password, CancellationToken.None);
                _options.BackendApiUrl = form.ApiBaseUrl;
                _options.BackendWsUrl = AuthService.ComputeWsAgentUrl(form.ApiBaseUrl);
                _options.JwtToken = token;

                AgentConfigStore.Save(_options, _configPath);
                ConnectIfPossible();
                return;
            }
            catch (Exception ex)
            {
                form.ShowError(ex.Message);
            }
        }
    }

    private void ConnectIfPossible()
    {
        if (string.IsNullOrWhiteSpace(_options.JwtToken))
        {
            UpdateStatus("Not authenticated");
            return;
        }

        _runtime.Start(_options);
        UpdateStatus("Connecting...");
    }

    private void Disconnect()
    {
        _runtime.Stop();
        UpdateStatusText();
    }

    private void OnRuntimeStatusChanged(AgentRuntimeStatus status, string? error)
    {
        OnUiThread(() =>
        {
            switch (status)
            {
                case AgentRuntimeStatus.Connecting:
                    UpdateStatus("Connecting...");
                    break;
                case AgentRuntimeStatus.Connected:
                    UpdateStatus("Connected");
                    break;
                case AgentRuntimeStatus.Error:
                    UpdateStatus($"Error: {error}");
                    break;
                default:
                    UpdateStatusText();
                    break;
            }
        });
    }

    private void UpdateStatusText()
    {
        if (string.IsNullOrWhiteSpace(_options.JwtToken))
        {
            UpdateStatus("Not authenticated");
            return;
        }

        UpdateStatus(_runtime.IsRunning ? "Running" : "Stopped");
    }

    private void UpdateStatus(string text)
    {
        OnUiThread(() =>
        {
            _statusItem.Text = $"Status: {text}";
            var display = $"Remote Docker Agent - {text}";
            _notifyIcon.Text = display.Length <= 63 ? display : display[..63];
        });
    }

    private void OnUiThread(Action action)
    {
        if (_uiControl.IsDisposed)
        {
            return;
        }

        if (_uiControl.InvokeRequired)
        {
            _uiControl.BeginInvoke(action);
            return;
        }

        action();
    }

    protected override void ExitThreadCore()
    {
        _runtime.Stop();
        _uiControl.Dispose();
        _notifyIcon.Visible = false;
        _notifyIcon.Dispose();
        base.ExitThreadCore();
    }
}
