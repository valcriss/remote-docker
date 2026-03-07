using System.Drawing;
using System.Windows.Forms;

namespace RemoteDocker.Agent;

public sealed class InstantiateForm : Form
{
    private readonly ComboBox _templatesCombo;
    private readonly TextBox _instanceNameText;
    private readonly DataGridView _portsGrid;
    private readonly DataGridView _volumesGrid;
    private readonly Label _infoLabel;

    private readonly IReadOnlyList<CatalogTemplateItem> _templates;

    public CatalogTemplateItem? SelectedTemplate =>
        _templatesCombo.SelectedIndex >= 0 && _templatesCombo.SelectedIndex < _templates.Count
            ? _templates[_templatesCombo.SelectedIndex]
            : null;

    public string InstanceName => _instanceNameText.Text.Trim();

    public InstantiateForm(IReadOnlyList<CatalogTemplateItem> templates)
    {
        _templates = templates;

        Text = "Instantiate Catalog Template";
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(920, 620);

        var root = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(12),
            ColumnCount = 1,
            RowCount = 6
        };

        var top = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 4, RowCount = 2, Height = 80 };
        top.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 120));
        top.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 45));
        top.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 120));
        top.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 55));

        top.Controls.Add(new Label { Text = "Template", AutoSize = true, Anchor = AnchorStyles.Left }, 0, 0);
        _templatesCombo = new ComboBox { Dock = DockStyle.Fill, DropDownStyle = ComboBoxStyle.DropDownList };
        foreach (var template in templates)
        {
            _templatesCombo.Items.Add($"{template.Name} ({template.Type})");
        }
        if (_templatesCombo.Items.Count > 0)
        {
            _templatesCombo.SelectedIndex = 0;
        }
        _templatesCombo.SelectedIndexChanged += (_, _) => LoadTemplateSelections();
        top.Controls.Add(_templatesCombo, 1, 0);

        top.Controls.Add(new Label { Text = "Instance name", AutoSize = true, Anchor = AnchorStyles.Left }, 2, 0);
        _instanceNameText = new TextBox { Dock = DockStyle.Fill, Text = $"instance-{DateTimeOffset.Now:HHmmss}" };
        top.Controls.Add(_instanceNameText, 3, 0);

        _infoLabel = new Label { AutoSize = true, ForeColor = Color.DimGray };
        top.Controls.Add(_infoLabel, 0, 1);
        top.SetColumnSpan(_infoLabel, 4);

        root.Controls.Add(top, 0, 0);

        var portsTitle = new Label { Text = "Local Port Forward Selection", AutoSize = true, Font = new Font(Font, FontStyle.Bold) };
        root.Controls.Add(portsTitle, 0, 1);

        _portsGrid = BuildPortsGrid();
        root.Controls.Add(_portsGrid, 0, 2);

        var volumesTitle = new Label { Text = "Volume Mapping Selection", AutoSize = true, Font = new Font(Font, FontStyle.Bold) };
        root.Controls.Add(volumesTitle, 0, 3);

        _volumesGrid = BuildVolumesGrid();
        root.Controls.Add(_volumesGrid, 0, 4);

        var buttons = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.RightToLeft, Height = 40 };
        var ok = new Button { Text = "Create", DialogResult = DialogResult.OK, AutoSize = true };
        var cancel = new Button { Text = "Cancel", DialogResult = DialogResult.Cancel, AutoSize = true };
        buttons.Controls.Add(ok);
        buttons.Controls.Add(cancel);
        root.Controls.Add(buttons, 0, 5);

        AcceptButton = ok;
        CancelButton = cancel;
        Controls.Add(root);

        LoadTemplateSelections();
    }

    public bool TryCollectSelections(out List<VolumeOverrideRequest> volumeOverrides, out List<ForwardRequest> forwards, out string error)
    {
        error = string.Empty;
        volumeOverrides = new List<VolumeOverrideRequest>();
        forwards = new List<ForwardRequest>();

        if (SelectedTemplate is null)
        {
            error = "No template selected.";
            return false;
        }

        if (string.IsNullOrWhiteSpace(InstanceName))
        {
            error = "Instance name is required.";
            return false;
        }

        var usedLocalPorts = new HashSet<int>();

        foreach (DataGridViewRow row in _portsGrid.Rows)
        {
            if (row.IsNewRow)
            {
                continue;
            }

            var enabled = (row.Cells[0].Value as bool?) == true;
            if (!enabled)
            {
                continue;
            }

            var serviceName = Convert.ToString(row.Cells[1].Value) ?? string.Empty;
            var portName = Convert.ToString(row.Cells[2].Value) ?? string.Empty;
            var localPortRaw = Convert.ToString(row.Cells[4].Value) ?? string.Empty;

            if (!int.TryParse(localPortRaw, out var localPort) || localPort < 1 || localPort > 65535)
            {
                error = $"Invalid local port for {serviceName}/{portName}.";
                return false;
            }

            if (!usedLocalPorts.Add(localPort))
            {
                error = $"Local port {localPort} is duplicated.";
                return false;
            }

            forwards.Add(new ForwardRequest(serviceName, portName, localPort));
        }

        foreach (DataGridViewRow row in _volumesGrid.Rows)
        {
            if (row.IsNewRow)
            {
                continue;
            }

            var mapped = (row.Cells[0].Value as bool?) == true;
            if (!mapped)
            {
                continue;
            }

            var volumeName = Convert.ToString(row.Cells[2].Value) ?? string.Empty;
            var localPath = Convert.ToString(row.Cells[4].Value) ?? string.Empty;
            var mode = Convert.ToString(row.Cells[5].Value) ?? "SYNC_BIDIRECTIONAL";
            var conflict = Convert.ToString(row.Cells[6].Value) ?? "PREFER_REMOTE";

            if (string.IsNullOrWhiteSpace(volumeName))
            {
                error = "Volume name is missing.";
                return false;
            }

            if (string.IsNullOrWhiteSpace(localPath))
            {
                error = $"Local path required for mapped volume '{volumeName}'.";
                return false;
            }

            volumeOverrides.Add(new VolumeOverrideRequest(volumeName, localPath, mode, conflict));
        }

        return true;
    }

    private DataGridView BuildPortsGrid()
    {
        var grid = new DataGridView
        {
            Dock = DockStyle.Fill,
            AutoGenerateColumns = false,
            AllowUserToAddRows = false,
            RowHeadersVisible = false,
            Height = 180
        };

        grid.Columns.Add(new DataGridViewCheckBoxColumn { HeaderText = "Forward", Width = 70 });
        grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Service", ReadOnly = true, Width = 140 });
        grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Port Name", ReadOnly = true, Width = 140 });
        grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Container Port", ReadOnly = true, Width = 120 });
        grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Local Port", Width = 120 });

        return grid;
    }

    private DataGridView BuildVolumesGrid()
    {
        var grid = new DataGridView
        {
            Dock = DockStyle.Fill,
            AutoGenerateColumns = false,
            AllowUserToAddRows = false,
            RowHeadersVisible = false,
            Height = 220
        };

        grid.Columns.Add(new DataGridViewCheckBoxColumn { HeaderText = "Map", Width = 60 });
        grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Service", ReadOnly = true, Width = 120 });
        grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Volume", ReadOnly = true, Width = 130 });
        grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Mount Path", ReadOnly = true, Width = 180 });
        grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Local Path", Width = 240 });

        var mode = new DataGridViewComboBoxColumn { HeaderText = "Mode", Width = 140 };
        mode.Items.Add("REMOTE_ONLY");
        mode.Items.Add("SYNC_BIDIRECTIONAL");
        grid.Columns.Add(mode);

        var conflict = new DataGridViewComboBoxColumn { HeaderText = "Conflict", Width = 140 };
        conflict.Items.Add("PREFER_LOCAL");
        conflict.Items.Add("PREFER_REMOTE");
        conflict.Items.Add("MANUAL");
        grid.Columns.Add(conflict);

        return grid;
    }

    private void LoadTemplateSelections()
    {
        _portsGrid.Rows.Clear();
        _volumesGrid.Rows.Clear();

        var template = SelectedTemplate;
        if (template is null)
        {
            _infoLabel.Text = "No template selected.";
            return;
        }

        _infoLabel.Text = template.Description is { Length: > 0 }
            ? template.Description
            : $"Template type: {template.Type}";

        var offset = 10000;
        for (var i = 0; i < template.Ports.Count; i++)
        {
            var p = template.Ports[i];
            var localPort = p.Port + offset + i;
            _portsGrid.Rows.Add(false, p.ServiceName, p.Name, p.Port.ToString(), localPort.ToString());
        }

        foreach (var v in template.Volumes)
        {
            _volumesGrid.Rows.Add(false, v.ServiceName, v.Name, v.MountPath, string.Empty, "SYNC_BIDIRECTIONAL", v.DefaultConflictPolicy);
        }
    }
}