import React from "react";
import { View, Text, ScrollView, Image, StyleSheet, Button } from "react-native";
import { API_BASE, getCompleted } from "../api";

export default function CompletedScreen() {
  const [items, setItems] = React.useState<any[]>([]);
  const [status, setStatus] = React.useState("Loading...");

  async function loadCompleted() {
    try {
      setStatus("Loading...");
      const res = await getCompleted();
      setItems(res.completed ?? []);
      setStatus("");
    } catch (err: any) {
      setStatus(`Failed to load: ${err.message}`);
    }
  }

  React.useEffect(() => {
    loadCompleted();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Completed Quests</Text>

      <Button title="Refresh" onPress={loadCompleted} />

      {status ? <Text style={styles.status}>{status}</Text> : null}

      {items.map((item, index) => (
        <View key={`${item.filename}-${index}`} style={styles.card}>
          <Text style={styles.questName}>
            {item.quest_name || item.quest_id || "Unknown Quest"}
          </Text>

          <Text style={styles.description}>
            {item.quest_description || ""}
          </Text>

          <Text style={styles.meta}>
            {item.timestamp}
          </Text>

          {item.file_url ? (
            <Image
              source={{ uri: `${API_BASE}${item.file_url}` }}
              style={styles.image}
            />
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
  },
  status: {
    fontSize: 14,
    opacity: 0.7,
  },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 14,
    padding: 14,
    gap: 8,
    backgroundColor: "#fff",
  },
  questName: {
    fontSize: 18,
    fontWeight: "700",
  },
  description: {
    fontSize: 14,
    opacity: 0.8,
  },
  meta: {
    fontSize: 12,
    opacity: 0.6,
  },
  image: {
    width: "100%",
    height: 260,
    borderRadius: 10,
    backgroundColor: "#eee",
  },
});
