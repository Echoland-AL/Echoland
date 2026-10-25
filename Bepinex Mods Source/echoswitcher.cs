using System;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using BepInEx;
using UnityEngine;

namespace EchoSwitchRerouter
{
    [BepInPlugin("echoswitch.rerouter", "EchoSwitch Rerouter", "1.0.6")]
    public class EchoSwitchRerouter : BaseUnityPlugin
    {
        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern bool SetWindowText(IntPtr hwnd, string lpString);

        [DllImport("user32.dll")]
        private static extern IntPtr GetActiveWindow();

        [DllImport("user32.dll")]
        private static extern IntPtr FindWindow(string className, string windowName);

        [DllImport("user32.dll")]
        private static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern IntPtr LoadImage(IntPtr hInstance, string lpImageName, uint uType, int cxDesired, int cyDesired, uint fuLoad);

        private string serverIp = "127.0.0.1";
        private bool titleChanged = false;
        private bool iconChanged = false;

        public void Awake()
        {
            LoadServerIpOverride();

            string apiBaseUrl = "http://" + this.serverIp;
            string cdnThingsUrl = "http://" + this.serverIp + "/cdn-things";
            string cdnBundlesUrl = "http://" + this.serverIp + "/cdn-bundles";
            string cdnSteamUrl = "http://" + this.serverIp + "/cdn-steam";

            ServerManager serverManager = UnityEngine.Object.FindObjectOfType<ServerManager>();
            if (serverManager != null)
            {
                serverManager.RemoteServerBaseUrl = apiBaseUrl;
            }

            // Assign distinct path targets for each CDN endpoint
            ChangeCdnUrl("GetThingDefinition_CDN", cdnThingsUrl);
            ChangeCdnUrl("GetThingDefinitionAreaBundle_CDN", cdnBundlesUrl);
            ChangeCdnUrl("SteamUserImages_CDN", cdnSteamUrl);
            ModifyServerBaseUrl(apiBaseUrl);

            Logger.LogInfo($"EchoSwitch Rerouter initialized. Target: {this.serverIp}");
        }

        private void LoadServerIpOverride()
        {
            try
            {
                string configPath = Path.Combine(Paths.ConfigPath, "echoswitch_server_ip.cfg");
                if (File.Exists(configPath))
                {
                    string value = File.ReadAllText(configPath).Trim();
                    if (!string.IsNullOrEmpty(value))
                    {
                        this.serverIp = value;
                    }
                }
            }
            catch (Exception ex)
            {
                Logger.LogError($"Failed to load config: {ex.Message}");
            }
        }

        private void Update()
        {
            if (!this.titleChanged) TryChangeWindowTitle();
            if (!this.iconChanged && Time.time > 3f) TryChangeWindowIcon();
        }

        private void TryChangeWindowTitle()
        {
            IntPtr windowHandle = GetWindowHandle();
            if (windowHandle != IntPtr.Zero)
            {
                if (SetWindowText(windowHandle, "EchoSwitch")) this.titleChanged = true;
            }
        }

        private void TryChangeWindowIcon()
        {
            IntPtr windowHandle = GetWindowHandle();
            if (windowHandle != IntPtr.Zero)
            {
                string iconPath = ExtractIconFromResources();
                if (!string.IsNullOrEmpty(iconPath) && File.Exists(iconPath))
                {
                    if (SetWindowIconFromFile(windowHandle, iconPath)) this.iconChanged = true;
                    try { File.Delete(iconPath); } catch { }
                }
            }
        }

        private IntPtr GetWindowHandle()
        {
            IntPtr intPtr = GetActiveWindow();
            if (intPtr == IntPtr.Zero) intPtr = FindWindow(null, UnityEngine.Application.productName);
            if (intPtr == IntPtr.Zero) intPtr = FindWindow("UnityWndClass", null);
            return intPtr;
        }

        private string ExtractIconFromResources()
        {
            try
            {
                Assembly executingAssembly = Assembly.GetExecutingAssembly();
                foreach (string text2 in executingAssembly.GetManifestResourceNames())
                {
                    if (text2.ToLowerInvariant().Contains("favicon") || text2.ToLowerInvariant().Contains(".ico"))
                    {
                        string tempFileName = Path.GetTempFileName();
                        string text3 = Path.ChangeExtension(tempFileName, ".ico");
                        using (Stream manifestResourceStream = executingAssembly.GetManifestResourceStream(text2))
                        using (FileStream fileStream = new FileStream(text3, FileMode.Create))
                        {
                            byte[] array2 = new byte[4096];
                            int count;
                            while ((count = manifestResourceStream.Read(array2, 0, array2.Length)) > 0)
                            {
                                fileStream.Write(array2, 0, count);
                            }
                        }
                        return text3;
                    }
                }
            }
            catch { }
            return null;
        }

        private bool SetWindowIconFromFile(IntPtr hWnd, string iconPath)
        {
            try
            {
                IntPtr intPtr = LoadImage(IntPtr.Zero, iconPath, 1U, 0, 0, 16U);
                if (intPtr != IntPtr.Zero)
                {
                    SendMessage(hWnd, 128U, (IntPtr)0, intPtr);
                    SendMessage(hWnd, 128U, (IntPtr)1, intPtr);
                    return true;
                }
            }
            catch { }
            return false;
        }

        private void ModifyServerBaseUrl(string baseUrl)
        {
            Type typeFromHandle = typeof(ServerManager);
            object obj = UnityEngine.Object.FindObjectOfType(typeFromHandle);
            if (obj != null)
            {
                FieldInfo field = typeFromHandle.GetField("serverBaseUrl", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
                try { field?.SetValue(obj, baseUrl); } catch { }
            }
        }

        private void ChangeCdnUrl(string fieldName, string newUrl)
        {
            Type typeFromHandle = typeof(ServerURLs);
            FieldInfo field = typeFromHandle.GetField(fieldName, BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
            try { field?.SetValue(null, newUrl); } catch { }
        }
    }
}