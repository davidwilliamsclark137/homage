import { router } from "expo-router";
import { Platform, Pressable, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import guide from "../features/mckinney/skyGuide.json";

export default function SkyGuide() {
  return (
    <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
      <Pressable
        accessibilityRole="button"
        style={styles.back}
        onPress={() => router.back()}
      >
        <Text style={styles.label}>← Back to map</Text>
      </Pressable>
      {Platform.OS === "web" ? (
        <iframe
          title="How sky scanning works"
          srcDoc={guide.html}
          style={{ flex: 1, width: "100%", border: 0 }}
        />
      ) : (
        <WebView
          source={{ html: guide.html }}
          javaScriptEnabled
          style={{ flex: 1 }}
        />
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#101e24" },
  back: { padding: 16 },
  label: { color: "#80edbc", fontSize: 16 },
});
