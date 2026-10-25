using System;
using System.Collections.Generic;
using System.Net;
using System.Text;
using System.Threading;
using BepInEx;
using BepInEx.Logging;
using UnityEngine;
using Valve.VR;

// Token: 0x02000002 RID: 2
[BepInPlugin("echoland.vrlocomotion", "Anyland VR Locomotion", "1.0.1")]
public class AnylandVrLocomotion : BaseUnityPlugin
{
	// Token: 0x06000001 RID: 1 RVA: 0x00002050 File Offset: 0x00000250
	private void Start()
	{
		base.Logger.LogInfo("Anyland VR Locomotion (no jump) loaded");
		this.StartHttpServer();
	}

	// Token: 0x06000002 RID: 2 RVA: 0x0000206B File Offset: 0x0000026B
	private void OnDestroy()
	{
		this.StopHttpServer();
	}

	// Token: 0x06000003 RID: 3 RVA: 0x00002078 File Offset: 0x00000278
	private void Update()
	{
		bool flag = !this.initialized;
		if (flag)
		{
			this.TryInit();
		}
		bool flag2 = !this.initialized || !this.locomotionEnabled;
		if (!flag2)
		{
			this.UpdateDeviceIndices();
			this.HandleMovement();
		}
	}

	// Token: 0x06000004 RID: 4 RVA: 0x000020C4 File Offset: 0x000002C4
	private void TryInit()
	{
		MonoBehaviour[] array = UnityEngine.Object.FindObjectsOfType<MonoBehaviour>();
		foreach (MonoBehaviour monoBehaviour in array)
		{
			bool flag = monoBehaviour == null;
			if (!flag)
			{
				Type type = monoBehaviour.GetType();
				bool flag2 = type != null && type.Name == "SteamVR_ControllerManager";
				if (flag2)
				{
					this.rigTransform = monoBehaviour.transform;
					base.Logger.LogInfo("Found rig: " + this.rigTransform.name);
					break;
				}
			}
		}
		bool flag3 = this.rigTransform == null;
		if (flag3)
		{
			base.Logger.LogWarning("Could not find rig (SteamVR_ControllerManager).");
		}
		else
		{
			Camera main = Camera.main;
			bool flag4 = main != null;
			if (flag4)
			{
				this.hmdTransform = main.transform;
				this.initialized = true;
				base.Logger.LogInfo("VR Locomotion initialized.");
			}
			else
			{
				base.Logger.LogWarning("Camera.main not found yet.");
			}
		}
	}

	// Token: 0x06000005 RID: 5 RVA: 0x000021CC File Offset: 0x000003CC
	private void UpdateDeviceIndices()
	{
		this.leftIndex = SteamVR_Controller.GetDeviceIndex(SteamVR_Controller.DeviceRelation.Leftmost, ETrackedDeviceClass.Controller, 0);
		this.rightIndex = SteamVR_Controller.GetDeviceIndex(SteamVR_Controller.DeviceRelation.Rightmost, ETrackedDeviceClass.Controller, 0);
	}

	// Token: 0x06000006 RID: 6 RVA: 0x000021EC File Offset: 0x000003EC
	private void HandleMovement()
	{
		bool flag = this.leftIndex < 0;
		if (!flag)
		{
			SteamVR_Controller.Device device = SteamVR_Controller.Input(this.leftIndex);
			bool flag2 = !device.connected;
			if (!flag2)
			{
				Vector2 axis = device.GetAxis(EVRButtonId.k_EButton_Axis0);
				bool touch = device.GetTouch(EVRButtonId.k_EButton_Axis0);
				bool flag3 = !touch || axis.magnitude < 0.2f;
				if (!flag3)
				{
					float x = axis.x;
					float y = axis.y;
					Vector3 forward = this.hmdTransform.forward;
					forward.y = 0f;
					forward.Normalize();
					Vector3 right = this.hmdTransform.right;
					right.y = 0f;
					right.Normalize();
					Vector3 vector = forward * y + right * x;
					bool flag4 = vector.sqrMagnitude < 0.0001f;
					if (!flag4)
					{
						bool press = device.GetPress(EVRButtonId.k_EButton_Axis1);
						float d = this.walkSpeed * (press ? this.runMultiplier : 1f);
						this.rigTransform.position += vector.normalized * d * Time.deltaTime;
					}
				}
			}
		}
	}

	// Token: 0x06000007 RID: 7 RVA: 0x00002334 File Offset: 0x00000534
	private void StartHttpServer()
	{
		try
		{
			this.listener = new HttpListener();
			this.listener.Prefixes.Add("http://127.0.0.1:47992/");
			this.listener.Start();
			this.httpRunning = true;
			this.httpThread = new Thread(new ThreadStart(this.HttpLoop));
			this.httpThread.IsBackground = true;
			this.httpThread.Start();
			base.Logger.LogInfo("VR Locomotion HTTP server started");
		}
		catch (Exception ex)
		{
			ManualLogSource logger = base.Logger;
			string str = "Failed to start HTTP server: ";
			Exception ex2 = ex;
			logger.LogError(str + ((ex2 != null) ? ex2.ToString() : null));
		}
	}

	// Token: 0x06000008 RID: 8 RVA: 0x000023F4 File Offset: 0x000005F4
	private void StopHttpServer()
	{
		this.httpRunning = false;
		try
		{
			bool flag = this.listener != null;
			if (flag)
			{
				this.listener.Stop();
				this.listener.Close();
				this.listener = null;
			}
		}
		catch
		{
		}
		bool flag2 = this.httpThread != null && this.httpThread.IsAlive;
		if (flag2)
		{
			this.httpThread.Abort();
		}
	}

	// Token: 0x06000009 RID: 9 RVA: 0x00002478 File Offset: 0x00000678
	private void HttpLoop()
	{
		while (this.httpRunning)
		{
			HttpListenerContext httpListenerContext = null;
			try
			{
				httpListenerContext = this.listener.GetContext();
			}
			catch
			{
				bool flag = !this.httpRunning;
				if (flag)
				{
					break;
				}
				continue;
			}
			bool flag2 = httpListenerContext == null;
			if (!flag2)
			{
				string absolutePath = httpListenerContext.Request.Url.AbsolutePath;
				string query = httpListenerContext.Request.Url.Query;
				bool flag3 = absolutePath == "/toggle";
				if (flag3)
				{
					Dictionary<string, string> dictionary = this.ParseQuery(query);
					bool flag4 = dictionary.ContainsKey("enabled");
					if (flag4)
					{
						this.locomotionEnabled = (dictionary["enabled"] == "1");
					}
					this.SendText(httpListenerContext, "OK", 200);
				}
				else
				{
					bool flag5 = absolutePath == "/";
					if (flag5)
					{
						this.SendHtml(httpListenerContext, this.BuildHtml());
					}
					else
					{
						this.SendText(httpListenerContext, "Not found", 404);
					}
				}
			}
		}
	}

	// Token: 0x0600000A RID: 10 RVA: 0x000025A0 File Offset: 0x000007A0
	private Dictionary<string, string> ParseQuery(string query)
	{
		Dictionary<string, string> dictionary = new Dictionary<string, string>();
		bool flag = string.IsNullOrEmpty(query);
		Dictionary<string, string> result;
		if (flag)
		{
			result = dictionary;
		}
		else
		{
			bool flag2 = query.StartsWith("?");
			if (flag2)
			{
				query = query.Substring(1);
			}
			string[] array = query.Split(new char[]
			{
				'&'
			});
			foreach (string text in array)
			{
				string[] array3 = text.Split(new char[]
				{
					'='
				});
				bool flag3 = array3.Length == 2;
				if (flag3)
				{
					string key = Uri.UnescapeDataString(array3[0].Replace("+", " "));
					string value = Uri.UnescapeDataString(array3[1].Replace("+", " "));
					dictionary[key] = value;
				}
			}
			result = dictionary;
		}
		return result;
	}

	// Token: 0x0600000B RID: 11 RVA: 0x00002678 File Offset: 0x00000878
	private string BuildHtml()
	{
		string str = this.locomotionEnabled ? "checked" : "";
		StringBuilder stringBuilder = new StringBuilder();
		stringBuilder.AppendLine("<!DOCTYPE html>");
		stringBuilder.AppendLine("<html><head><meta charset='utf-8'><title>Anyland VR Locomotion</title></head><body>");
		stringBuilder.AppendLine("<h1>Anyland VR Locomotion</h1>");
		stringBuilder.AppendLine("<label><input type='checkbox' id='locToggle' " + str + "> Enable locomotion</label><br><br>");
		stringBuilder.AppendLine("<script>");
		stringBuilder.AppendLine("document.getElementById('locToggle').addEventListener('change', function(){");
		stringBuilder.AppendLine("  var en = this.checked ? 1 : 0;");
		stringBuilder.AppendLine("  fetch('/toggle?enabled=' + en).catch(()=>{});");
		stringBuilder.AppendLine("});");
		stringBuilder.AppendLine("</script>");
		stringBuilder.AppendLine("</body></html>");
		return stringBuilder.ToString();
	}

	// Token: 0x0600000C RID: 12 RVA: 0x0000273C File Offset: 0x0000093C
	private void SendText(HttpListenerContext ctx, string text, int statusCode = 200)
	{
		byte[] bytes = Encoding.UTF8.GetBytes(text);
		ctx.Response.StatusCode = statusCode;
		ctx.Response.ContentType = "text/plain; charset=utf-8";
		ctx.Response.ContentLength64 = (long)bytes.Length;
		ctx.Response.OutputStream.Write(bytes, 0, bytes.Length);
		ctx.Response.OutputStream.Close();
	}

	// Token: 0x0600000D RID: 13 RVA: 0x000027AC File Offset: 0x000009AC
	private void SendHtml(HttpListenerContext ctx, string html)
	{
		byte[] bytes = Encoding.UTF8.GetBytes(html);
		ctx.Response.StatusCode = 200;
		ctx.Response.ContentType = "text/html; charset=utf-8";
		ctx.Response.ContentLength64 = (long)bytes.Length;
		ctx.Response.OutputStream.Write(bytes, 0, bytes.Length);
		ctx.Response.OutputStream.Close();
	}

	// Token: 0x04000001 RID: 1
	private Transform rigTransform;

	// Token: 0x04000002 RID: 2
	private Transform hmdTransform;

	// Token: 0x04000003 RID: 3
	private bool initialized = false;

	// Token: 0x04000004 RID: 4
	private bool locomotionEnabled = true;

	// Token: 0x04000005 RID: 5
	private float walkSpeed = 2f;

	// Token: 0x04000006 RID: 6
	private float runMultiplier = 2f;

	// Token: 0x04000007 RID: 7
	private Thread httpThread;

	// Token: 0x04000008 RID: 8
	private HttpListener listener;

	// Token: 0x04000009 RID: 9
	private bool httpRunning = false;

	// Token: 0x0400000A RID: 10
	private int leftIndex = -1;

	// Token: 0x0400000B RID: 11
	private int rightIndex = -1;
}
