// app/app/index.tsx
import * as React from "react";
import { View, Text, Button, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../api";

export default function Index() {
  const [status, setStatus] = React.useState<string>("Checking backend...");
  const router = useRouter();

  React.useEffect(() => {
    (async () => {
      try {
        const res = await api.health();
        setStatus(JSON.stringify(res, null, 2));
      } catch (err: any) {
        setStatus(`❌ Backend unreachable: ${err.message}`);
      }
    })();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Homage Backend Check</Text>
      <Text selectable style={styles.status}>
        {status}
      </Text>
      <Button title="Go to Capture" onPress={() => router.push("/capture")} />
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
    marginBottom: 16,
  },
  status: {
    fontSize: 14,
    textAlign: "left",
    backgroundColor: "#f0f0f0",
    padding: 12,
    borderRadius: 8,
    width: "100%",
    marginBottom: 20,
  },
});
