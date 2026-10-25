using BepInEx;
using BepInEx.Configuration;
using HarmonyLib;

namespace AnylandPerformancePersist
{
    [BepInPlugin("com.gamedrix.anyland.performancepersist", "Anyland Performance Persist", "1.5.0")]
    public class PerformancePersistPlugin : BaseUnityPlugin
    {
        public static ConfigEntry<int> SavedThings;
        public static ConfigEntry<int> SavedLights;
        public static ConfigEntry<int> SavedShadows;
        public static ConfigEntry<int> SavedImageParts;

        private void Awake()
        {
            SavedThings = Config.Bind("Performance", "MaxThingsAround", 250, "Saved max things around");
            SavedLights = Config.Bind("Performance", "MaxLightsAround", 3, "Saved max lights around");
            SavedShadows = Config.Bind("Performance", "MaxLightsToThrowShadows", 1, "Saved max shade lights");

            // Default 500 for image parts
            SavedImageParts = Config.Bind("Performance", "MaxImagePartsAround", 500, "Saved max image parts around");

            Harmony harmony = new Harmony("com.gamedrix.anyland.performancepersist");
            harmony.PatchAll();
        }
    }

    [HarmonyPatch(typeof(OptimizationManager), "Startup")]
    public class Patch_Startup
    {
        static void Prefix(OptimizationManager __instance)
        {
            __instance.maxThingsAroundOverride = PerformancePersistPlugin.SavedThings.Value;
            __instance.maxLightsAroundOverride = PerformancePersistPlugin.SavedLights.Value;
            __instance.maxLightsToThrowShadowsOverride = PerformancePersistPlugin.SavedShadows.Value;
            // Do not touch image parts here
        }
    }

    [HarmonyPatch(typeof(OptimizationManager), "UpdateSettings")]
    public class Patch_UpdateSettings
    {
        static void Postfix(OptimizationManager __instance)
        {
            // Apply image parts AFTER UpdateSettings using the backing field
            var imgField = AccessTools.Field(typeof(OptimizationManager), "<maxImagePartsAroundCount>k__BackingField");
            imgField.SetValue(__instance, PerformancePersistPlugin.SavedImageParts.Value);

            // Save overrides
            if (__instance.maxThingsAroundOverride.HasValue)
                PerformancePersistPlugin.SavedThings.Value = __instance.maxThingsAroundOverride.Value;

            if (__instance.maxLightsAroundOverride.HasValue)
                PerformancePersistPlugin.SavedLights.Value = __instance.maxLightsAroundOverride.Value;

            if (__instance.maxLightsToThrowShadowsOverride.HasValue)
                PerformancePersistPlugin.SavedShadows.Value = __instance.maxLightsToThrowShadowsOverride.Value;

            // Read back image parts from the same backing field
            int imgParts = (int)imgField.GetValue(__instance);
            PerformancePersistPlugin.SavedImageParts.Value = imgParts;

            // Save config to disk
            PerformancePersistPlugin.SavedThings.ConfigFile.Save();
        }
    }
}
