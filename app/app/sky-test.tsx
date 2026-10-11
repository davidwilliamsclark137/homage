import { useCallback, useEffect, useState } from "react";
import {
  AppState,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import SkyScanner from "../features/sky/SkyScanner";

export default function SkyTest() {
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [focused, setFocused] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    return () => subscription.remove();
  }, []);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const onScan = useCallback((id: string, report?: string) => {
    setResult(report ?? `Direction acquired: ${id}`);
  }, []);
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.link}>← Back to portals</Text>
        </Pressable>
        <Text style={styles.title}>Sky test</Text>
        <Text style={styles.text}>
          Hold your iPhone upright in portrait. Tilt it up and turn slowly: the
          camera direction and elevation below should follow your movement.
          Stand away from cars and metal.
        </Text>
        <Text style={styles.text}>
          This is an optional sensor test. Your portal journey stays available.
          After dark, compare the marker with the actual bright star; a
          completed hold alone does not prove the overlay is accurate.
        </Text>
        {result ? (
          <View style={styles.content}>
            <Text style={styles.title}>Direction held for 3 seconds</Text>
            <Text style={styles.text}>
              Did the marker match the real star, or was it offset? Please tell
              me which you saw.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void Share.share({ message: result })}
            >
              <Text style={styles.link}>Share diagnostic report</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setResult(null);
                setAttempt((value) => value + 1);
              }}
            >
              <Text style={styles.link}>Try again</Text>
            </Pressable>
            <Text selectable style={styles.text}>
              {result}
            </Text>
          </View>
        ) : (
          <SkyScanner
            key={attempt}
            laboratory
            active={foreground && focused}
            onScan={onScan}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#101f25" },
  content: { padding: 20, gap: 18 },
  title: { fontSize: 24, fontWeight: "700", color: "#edf8f1" },
  text: { fontSize: 16, lineHeight: 24, color: "#bed1ca" },
  link: {
    fontSize: 18,
    fontWeight: "600",
    color: "#80edbc",
    paddingVertical: 10,
  },
});
