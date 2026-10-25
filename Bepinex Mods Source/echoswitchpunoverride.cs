using System;
using BepInEx;
using HarmonyLib;

namespace PUN
{
	// Token: 0x02000002 RID: 2
	[BepInPlugin("com.echoswitch.pun.override", "EchoSwitch PUN Override", "1.0.0")]
	public class EchoSwitchPUNOverride : BaseUnityPlugin
	{
		// Token: 0x06000001 RID: 1 RVA: 0x00002050 File Offset: 0x00000250
		private void Awake()
		{
			Harmony harmony = new Harmony("com.echoswitch.pun.override");
			harmony.PatchAll();
			base.Logger.LogInfo("EchoSwitch PUN override loaded.");
		}
	}
}
