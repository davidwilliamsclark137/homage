import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { getHealth } from "../api";

export default function HealthScreen() {
  const [status, setStatus] = useState<string | null>(null);
  const [detail, setDetail] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getHealth();
        if (!mounted) return;
        setStatus(res.status ?? "unknown");
        setDetail(JSON.stringify(res, null, 2));
      } catch (e: any) {
        if (!mounted) return;
        setError(String(e?.message ?? e));
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (!status && !error) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.mono}>Checking backend…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={[styles.status, { color: "#c0392b" }]}>Backend error</Text>
        <Text style={styles.mono}>{error}</Text>
      </View>
    );
  }

  const ok = status === "ok";
  return (
    <View style={styles.container}>
      <Text style={[styles.status, { color: ok ? "#27ae60" : "#c0392b" }]}>
        {ok ? "✅ Backend is healthy" : `⚠️ Status: ${status}`}
      </Text>
      <Text style={styles.mono}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 },
  container: { flex: 1, padding: 16, gap: 12 },
  status: { fontSize: 20, fontWeight: "600" },
  mono: { fontFamily: "Menlo", fontSize: 12 },
});

