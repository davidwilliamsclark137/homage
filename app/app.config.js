// app.config.js — Homage
const API_BASE = process.env.API_BASE || "https://homage-backend.onrender.com";

module.exports = () => ({
  name: "Homage",
  slug: "homage",
  owner: "davidwilliamsclark",
  scheme: "homage",
  plugins: ["expo-router"],
  version: "1.0.0",                // ← used by EAS Update when runtimeVersion.policy = "appVersion"
  runtimeVersion: { policy: "appVersion" },
  updates: {
    // Use your projectId from EAS:
    url: "https://u.expo.dev/e8dd5376-de0c-45e6-bc68-ee6ddff3fc4d",
  },
  extra: {
    API_BASE,
    eas: { projectId: "e8dd5376-de0c-45e6-bc68-ee6ddff3fc4d" },
  },
  ios: {
    infoPlist: {
      NSCameraUsageDescription: "Homage uses your camera to capture images.",
      NSLocationWhenInUseUsageDescription: "Homage tags captures with GPS coordinates.",
    },
  },
  android: {
    permissions: ["android.permission.CAMERA", "android.permission.ACCESS_FINE_LOCATION"],
  },
});

