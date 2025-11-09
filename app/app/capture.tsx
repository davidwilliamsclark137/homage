// app/app/capture.tsx
import * as React from "react";
import { View, Text, Button, Alert, Image, StyleSheet, ScrollView } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "../api";
import { useRouter } from "expo-router";

export default function Capture() {
  const [imageUri, setImageUri] = React.useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = React.useState<string>("");

  const router = useRouter();

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission denied", "Please allow photo access to upload.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setImageUri(asset.uri);
    setUploadStatus("Uploading...");

    try {
      const blob = await fetch(asset.uri).then((r) => r.blob());
      const res = await api.uploadBlob(blob, asset.fileName || "photo.jpg");
      setUploadStatus(`✅ Uploaded to: ${res.saved} (${res.size} bytes)`);
    } catch (err: any) {
      console.error(err);
      setUploadStatus(`❌ Upload failed: ${err.message}`);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Capture & Upload</Text>

      <Button title="Pick image from library" onPress={pickImage} />

      {imageUri && (
        <View style={{ marginTop: 20 }}>
          <Image
            source={{ uri: imageUri }}
            style={{ width: 280, height: 280, borderRadius: 12 }}
          />
        </View>
      )}

      <Text selectable style={styles.status}>
        {uploadStatus}
      </Text>

      <Button title="← Back to Home" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 20,
  },
  status: {
    marginTop: 20,
    fontSize: 14,
    backgroundColor: "#f0f0f0",
    padding: 12,
    borderRadius: 8,
    width: "100%",
  },
});
