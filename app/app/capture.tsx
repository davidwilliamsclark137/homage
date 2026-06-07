import React, { useState } from "react";
import { View, Text, Image, Button, Alert, ActivityIndicator, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { uploadForm } from "../api";

export default function CaptureScreen() {
  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultText, setResultText] = useState<string>("");

  async function ensurePermissions() {
    const { status: cam } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: lib } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const { status: loc } = await Location.requestForegroundPermissionsAsync();
    if (cam !== "granted" || lib !== "granted") {
      Alert.alert("Permissions needed", "Camera and library access are required.");
      return false;
    }
    if (loc !== "granted") {
      // still allow capture without GPS
      Alert.alert("Location optional", "We'll continue without GPS.");
    }
    return true;
  }

  async function pickFromCamera() {
    if (!(await ensurePermissions())) return;
    const shot = await ImagePicker.launchCameraAsync({
      // ✅ Use the compatible API for your version
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      exif: true,
    });
    if (!shot.canceled) setUri(shot.assets[0].uri);
  }

  async function pickFromLibrary() {
    if (!(await ensurePermissions())) return;
    const sel = await ImagePicker.launchImageLibraryAsync({
      // ✅ Use the compatible API for your version
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      exif: true,
    });
    if (!sel.canceled) setUri(sel.assets[0].uri);
  }

  async function doUpload() {
    if (!uri) return;
    setBusy(true);
    setResultText("");

    try {
      // Try to get current GPS (optional)
      let lat: number | undefined;
      let lon: number | undefined;
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lon = loc.coords.longitude;
      } catch {
        // ignore if denied/unavailable
      }

      // Infer filename & type
      const filename = uri.split("/").pop() ?? `capture-${Date.now()}.jpg`;
      const ext = filename.toLowerCase().split(".").pop();
      const type =
        ext === "png" ? "image/png" :
        ext === "heic" ? "image/heic" :
        "image/jpeg";

      const form = new FormData();
      form.append("file", {
        // @ts-ignore — React Native FormData file shape
        uri,
        name: filename,
        type,
      });
      if (lat !== undefined && lon !== undefined) {
        form.append("lat", String(lat));
        form.append("lon", String(lon));
      }

      const json = await uploadForm(form);
      setResultText(JSON.stringify(json, null, 2));
      Alert.alert("Uploaded", "Your image was uploaded successfully.");
    } catch (e: any) {
      Alert.alert("Upload failed", String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Capture</Text>

      <View style={styles.buttons}>
        <Button title="📷 Take Photo" onPress={pickFromCamera} />
        <Button title="🖼️ Pick From Library" onPress={pickFromLibrary} />
      </View>

      {uri ? (
        <Image source={{ uri }} style={styles.preview} resizeMode="cover" />
      ) : (
        <Text style={styles.hint}>Pick or take a photo to upload.</Text>
      )}

      <View style={{ height: 12 }} />

      <Button title={busy ? "Uploading…" : "⬆️ Upload to server"} onPress={doUpload} disabled={!uri || busy} />

      {busy && (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      )}

      {!!resultText && (
        <View style={styles.resultBox}>
          <Text style={styles.mono}>{resultText}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12, padding: 16 },
  title: { fontSize: 22, fontWeight: "700" },
  buttons: { flexDirection: "row", gap: 12, justifyContent: "space-between" },
  preview: { width: "100%", height: 280, borderRadius: 8, backgroundColor: "#eee" },
  hint: { opacity: 0.7 },
  center: { alignItems: "center", justifyContent: "center" },
  resultBox: { marginTop: 12, padding: 12, backgroundColor: "#fafafa", borderRadius: 8 },
  mono: { fontFamily: "Menlo", fontSize: 12 },
});

