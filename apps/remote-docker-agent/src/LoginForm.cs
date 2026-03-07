using System.Drawing;
using System.Windows.Forms;

namespace RemoteDocker.Agent;

public sealed class LoginForm : Form
{
    private readonly TextBox _apiUrlText;
    private readonly TextBox _emailText;
    private readonly TextBox _passwordText;
    private readonly Label _errorLabel;

    public string ApiBaseUrl => _apiUrlText.Text.Trim();
    public string Email => _emailText.Text.Trim();
    public string Password => _passwordText.Text;

    public LoginForm(string apiBaseUrl)
    {
        Text = "Remote Docker - Authentication";
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(520, 220);

        var panel = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(12),
            ColumnCount = 2,
            RowCount = 5
        };

        panel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 130));
        panel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));

        panel.Controls.Add(new Label { Text = "Backend API", AutoSize = true, Anchor = AnchorStyles.Left }, 0, 0);
        _apiUrlText = new TextBox { Text = apiBaseUrl, Dock = DockStyle.Fill };
        panel.Controls.Add(_apiUrlText, 1, 0);

        panel.Controls.Add(new Label { Text = "Email", AutoSize = true, Anchor = AnchorStyles.Left }, 0, 1);
        _emailText = new TextBox { Dock = DockStyle.Fill };
#if DEBUG
        _emailText.Text = "admin@example.com";
#endif
        panel.Controls.Add(_emailText, 1, 1);

        panel.Controls.Add(new Label { Text = "Password", AutoSize = true, Anchor = AnchorStyles.Left }, 0, 2);
        _passwordText = new TextBox { UseSystemPasswordChar = true, Dock = DockStyle.Fill };
#if DEBUG
        _passwordText.Text = "password123";
#endif
        panel.Controls.Add(_passwordText, 1, 2);

        _errorLabel = new Label { ForeColor = Color.Firebrick, AutoSize = true, Visible = false };
        panel.Controls.Add(_errorLabel, 0, 3);
        panel.SetColumnSpan(_errorLabel, 2);

        var buttons = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.RightToLeft };
        var ok = new Button { Text = "Login", DialogResult = DialogResult.OK, AutoSize = true };
        var cancel = new Button { Text = "Cancel", DialogResult = DialogResult.Cancel, AutoSize = true };
        buttons.Controls.Add(ok);
        buttons.Controls.Add(cancel);

        panel.Controls.Add(buttons, 0, 4);
        panel.SetColumnSpan(buttons, 2);

        AcceptButton = ok;
        CancelButton = cancel;
        Controls.Add(panel);
    }

    public void ShowError(string message)
    {
        _errorLabel.Text = message;
        _errorLabel.Visible = true;
    }
}