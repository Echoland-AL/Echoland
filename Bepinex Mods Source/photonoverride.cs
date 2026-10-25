using System;
using System.IO;
using BepInEx;
using HarmonyLib;

namespace PUN
{
	// Token: 0x02000003 RID: 3
	[HarmonyPatch(typeof(BroadcastNetworkManager))]
	[HarmonyPatch("OverridePhotonAppId")]
	public class OverridePhotonAppIdPatch
	{
		// Token: 0x06000003 RID: 3 RVA: 0x0000208C File Offset: 0x0000028C
		private static string LoadPunId()
		{
			string path = Path.Combine(Paths.ConfigPath, "pun_override.cfg");
			bool flag = File.Exists(path);
			if (flag)
			{
				try
				{
					return File.ReadAllText(path).Trim();
				}
				catch
				{
				}
			}
			return "2e9a3a49-0d8d-44b6-87fa-c1efb02389ce";
		}

		// Token: 0x06000004 RID: 4 RVA: 0x000020E4 File Offset: 0x000002E4
		private static void Prefix()
		{
			string appID = OverridePhotonAppIdPatch.LoadPunId();
			PhotonNetwork.PhotonServerSettings.AppID = appID;
		}

		// Token: 0x06000005 RID: 5 RVA: 0x00002104 File Offset: 0x00000304
		private static void Postfix()
		{
			string appID = OverridePhotonAppIdPatch.LoadPunId();
			PhotonNetwork.PhotonServerSettings.AppID = appID;
		}
	}
}
