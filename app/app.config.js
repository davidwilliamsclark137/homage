// app.config.js — Homage
const API_BASE = process.env.API_BASE || "https://homage-backend.onrender.com";

module.exports = () => ({
  name: "Homage",
  slug: "homage",
  owner: "davidwilliamsclark",
  privacy: "public",
  scheme: "homage",
  plugins: ["expo-router"],
  version: "1.0.0",

  // ✅ Key change: use SDK runtime so Expo Go can load your updates
  // (You can also just delete the whole runtimeVersion block—SDK is default)
  runtimeVersion: { policy: "sdkVersion" },

  updates: {
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
      // app.config.js (inside ios.infoPlist)
      NSLocationWhenInUseUsageDescription: "Homage shows your position on a map to tag captures.",

    },
  },
  android: {
    permissions: ["android.permission.CAMERA", "android.permission.ACCESS_FINE_LOCATION"],
    config: {
      googleMaps: { apiKey: process.env.ANDROID_GOOGLE_MAPS_API_KEY || "YOUR_ANDROID_GOOGLE_MAPS_API_KEY" }
    }
    },
});

