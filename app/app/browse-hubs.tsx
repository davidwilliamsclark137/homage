import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HUBS, HubKind } from "../lib/hubs";

type Filter = "all" | HubKind;
const colors = { background: "#F4F1EA", card: "#FFFFFF", ink: "#1D211F", muted: "#666C68", line: "#DCD8CF", green: "#264E3D", pale: "#E3ECE6" };

export default function BrowseHubsScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState(HUBS[0].id);
  const places = useMemo(() => HUBS.filter((hub) => filter === "all" || hub.kind === filter), [filter]);
  const selected = HUBS.find((hub) => hub.id === selectedId) ?? places[0] ?? HUBS[0];
  return <SafeAreaView style={styles.safe} edges={["bottom"]}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>GO SOMEWHERE</Text><Text style={styles.title}>Browse</Text><Text style={styles.intro}>Potential hubs to visit in cities and communities around the world.</Text>
    <View style={styles.filters}>{(["all", "city", "suburban", "monument"] as Filter[]).map((item) => <Pressable key={item} onPress={() => { setFilter(item); const first = HUBS.find((hub) => item === "all" || hub.kind === item); if (first) setSelectedId(first.id); }} style={[styles.filter, filter === item && styles.filterActive]}><Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text></Pressable>)}</View>
    <View style={styles.featured}><Text style={styles.candidate}>CANDIDATE · {selected.kind.toUpperCase()}</Text><Text style={styles.featuredTitle}>{selected.name}</Text><Text style={styles.place}>{selected.locality} · {selected.country}</Text><Text style={styles.reason}>{selected.reason}</Text></View>
    <Text style={styles.section}>Potential places</Text><View style={styles.list}>{places.map((hub) => <Pressable key={hub.id} onPress={() => setSelectedId(hub.id)} style={[styles.row, selected.id === hub.id && styles.rowSelected]}><View><Text style={styles.rowTitle}>{hub.name}</Text><Text style={styles.rowPlace}>{hub.locality}, {hub.country}</Text></View></Pressable>)}</View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { backgroundColor: colors.background, flex: 1 }, content: { padding: 20, paddingBottom: 48 }, eyebrow: { color: colors.green, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: 38, fontWeight: "700", letterSpacing: -1, marginTop: 5 }, intro: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 6 }, filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 20 }, filter: { borderColor: colors.line, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 }, filterActive: { backgroundColor: colors.green, borderColor: colors.green }, filterText: { color: colors.muted, fontSize: 12, textTransform: "capitalize" }, filterTextActive: { color: "#FFF", fontWeight: "700" }, featured: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: 18, borderWidth: 1, marginTop: 16, padding: 18 }, candidate: { color: colors.green, fontSize: 10, fontWeight: "800", letterSpacing: .8 }, featuredTitle: { color: colors.ink, fontSize: 22, fontWeight: "700", marginTop: 10 }, place: { color: colors.muted, fontSize: 13, marginTop: 4 }, reason: { color: colors.ink, fontSize: 14, lineHeight: 21, marginTop: 12 }, button: { alignItems: "center", backgroundColor: colors.green, borderRadius: 12, marginTop: 15, padding: 13 }, buttonText: { color: "#FFF", fontSize: 14, fontWeight: "700" }, section: { color: colors.ink, fontSize: 20, fontWeight: "700", marginTop: 28 }, list: { gap: 8, marginTop: 13 }, row: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: 14, borderWidth: 1, padding: 15 }, rowSelected: { borderColor: colors.green, borderWidth: 2, padding: 14 }, rowTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" }, rowPlace: { color: colors.muted, fontSize: 12, marginTop: 3 } });
