using System;
using System.IO;
using System.Net.NetworkInformation;
using System.Windows.Forms;

namespace EchoSwitch
{
    public partial class Form1 : Form
    {
        private const string DefaultPunId = "2e9a3a49-0d8d-44b6-87fa-c1efb02389ce";
        private const string DefaultServerIp = "127.0.0.1";
        private string selectedFolder = "";

        public Form1()
        {
            InitializeComponent();
            TryAutoDetectAnylandFolder();
            LoadCurrentPunId();
            LoadCurrentServerIp();
        }

        private void TryAutoDetectAnylandFolder()
        {
            try
            {
                string exeDir = AppDomain.CurrentDomain.BaseDirectory;
                string anylandExe = Path.Combine(exeDir, "Anyland.exe");
                if (File.Exists(anylandExe))
                {
                    selectedFolder = exeDir;
                    folderLabel.Text = "Selected (auto): " + selectedFolder;
                }
            }
            catch { }
        }

        private void LoadCurrentPunId()
        {
            if (string.IsNullOrEmpty(selectedFolder))
                return;

            string cfgPath = Path.Combine(selectedFolder, "BepInEx", "config", "pun_override.cfg");

            if (File.Exists(cfgPath))
            {
                string pun = File.ReadAllText(cfgPath).Trim();
                punBox.Text = pun;

                if (pun != DefaultPunId)
                    punLabel.Text = "PUN ID (modified):";
                else
                    punLabel.Text = "PUN ID:";
            }
            else
            {
                punBox.Text = DefaultPunId;
                punLabel.Text = "PUN ID:";
            }
        }

        private void LoadCurrentServerIp()
        {
            if (string.IsNullOrEmpty(selectedFolder))
                return;

            string cfgPath = Path.Combine(selectedFolder, "BepInEx", "config", "echoswitch_server_ip.cfg");

            if (File.Exists(cfgPath))
            {
                string ip = File.ReadAllText(cfgPath).Trim();
                ipBox.Text = ip;

                if (ip != DefaultServerIp)
                    ipLabel.Text = "Server IP (modified):";
                else
                    ipLabel.Text = "Server IP:";
            }
            else
            {
                ipBox.Text = DefaultServerIp;
                ipLabel.Text = "Server IP:";
            }
        }

        private void browseButton_Click(object sender, EventArgs e)
        {
            using (var dialog = new FolderBrowserDialog())
            {
                dialog.Description = "Select your Anyland game folder";
                dialog.ShowNewFolderButton = false;

                if (dialog.ShowDialog() == DialogResult.OK)
                {
                    selectedFolder = dialog.SelectedPath;
                    folderLabel.Text = "Selected: " + selectedFolder;
                    LoadCurrentPunId();
                    LoadCurrentServerIp();
                }
            }
        }

        private void localButton_Click(object sender, EventArgs e)
        {
            ipBox.Text = DefaultServerIp;
            ipLabel.Text = "Server IP:";
        }

        private void resetButton_Click(object sender, EventArgs e)
        {
            punBox.Text = DefaultPunId;
            punLabel.Text = "PUN ID:";
        }

        private void resetIpButton_Click(object sender, EventArgs e)
        {
            ipBox.Text = DefaultServerIp;
            ipLabel.Text = "Server IP:";
        }

        private void pingPunButton_Click(object sender, EventArgs e)
        {
            string punId = punBox.Text.Trim();
            if (string.IsNullOrEmpty(punId))
            {
                MessageBox.Show("Invalid PUN ID.");
                return;
            }

            try
            {
                Ping ping = new Ping();
                PingReply reply = ping.Send("app.anyland.com", 2000);
                if (reply.Status == IPStatus.Success)
                    MessageBox.Show("PUN server reachable.");
                else
                    MessageBox.Show("PUN server unreachable.");
            }
            catch
            {
                MessageBox.Show("PUN server unreachable.");
            }
        }

        private void pingServerButton_Click(object sender, EventArgs e)
        {
            string ip = ipBox.Text.Trim();
            if (string.IsNullOrEmpty(ip))
            {
                MessageBox.Show("Invalid server IP.");
                return;
            }

            try
            {
                Ping ping = new Ping();
                PingReply reply = ping.Send(ip, 2000);
                if (reply.Status == IPStatus.Success)
                    MessageBox.Show("Server reachable.");
                else
                    MessageBox.Show("Server unreachable.");
            }
            catch
            {
                MessageBox.Show("Server unreachable.");
            }
        }

        private void saveButton_Click(object sender, EventArgs e)
        {
            if (string.IsNullOrEmpty(selectedFolder))
            {
                MessageBox.Show("Please select your Anyland folder first.");
                return;
            }

            string punId = punBox.Text.Trim();
            if (string.IsNullOrEmpty(punId))
                punId = DefaultPunId;

            string serverIp = ipBox.Text.Trim();
            if (string.IsNullOrEmpty(serverIp))
            {
                MessageBox.Show("Please enter a server IP.");
                return;
            }

            try
            {
                string bepConfigDir = Path.Combine(selectedFolder, "BepInEx", "config");
                Directory.CreateDirectory(bepConfigDir);

                string punCfgPath = Path.Combine(bepConfigDir, "pun_override.cfg");
                File.WriteAllText(punCfgPath, punId);

                string dnsCfgPath = Path.Combine(bepConfigDir, "echoswitch_server_ip.cfg");
                File.WriteAllText(dnsCfgPath, serverIp);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error writing config: " + ex.Message);
                return;
            }

            MessageBox.Show("Settings saved successfully.");
            LoadCurrentPunId();
            LoadCurrentServerIp();
        }
    }
}
