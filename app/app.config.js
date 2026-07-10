// app.config.js — Homage
const API_BASE =
  process.env.API_BASE || "https://42c1-71-41-189-248.ngrok-free.app";

module.exports = () => ({
  name: "Homage",
  slug: "homage",
  owner: "davidwilliamsclark",
  privacy: "public",
  scheme: "homage",
  plugins: [
    "expo-router",
    [
      "expo-camera",
      {
        cameraPermission: "Allow Homage to scan document transfer QR codes.",
        recordAudioAndroid: false,
      },
    ],
    [
      "expo-sensors",
      {
        motionPermission: "Allow Homage to align constellations as you move your phone.",
      },
    ],
    [
      "expo-audio",
      {
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
  ],
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
      NSCameraUsageDescription:
        "Homage uses your camera to scan document transfer QR codes.",
      NSLocationWhenInUseUsageDescription:
        "Homage uses your position to place and unlock encrypted documents.",
    },
  },
  android: {
    permissions: [
      "android.permission.CAMERA",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
    ],
  },
});
