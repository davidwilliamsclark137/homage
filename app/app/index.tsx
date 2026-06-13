// app/app/index.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Link } from "expo-router";

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Homage</Text>
      <Text style={styles.subtitle}>Quick links</Text>

      <View style={styles.linkList}>
        <Link href="/capture" style={styles.link}>📷 Capture</Link>
        <Link href="/map" style={styles.link}>📍 Show my location</Link>
        <Link href="/game" style={styles.link}>🗺️ Explore game (auto-spawn)</Link>
	<Link href="/completed" style={styles.link}>✅ Completed Quests</Link>
        <Link href="/health" style={styles.link}>❤️ Backend health</Link>
      </View>

      <Text style={styles.footer}>
        Backend: https://homage-backend.onrender.com
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 18, opacity: 0.8 },
  linkList: { gap: 12, marginTop: 8 },
  link: { fontSize: 18, color: "#2f80ed" },
  footer: { marginTop: 32, fontSize: 12, opacity: 0.6 },
});

