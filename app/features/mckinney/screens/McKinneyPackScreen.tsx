import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MCKINNEY_PACK } from "../data/locationPack";

const colors = { background: "#F8F5EC", card: "#FFF", ink: "#17241D", muted: "#627067", green: "#275D45", bright: "#5AC47A", gold: "#E0A43A", line: "#DCD8CF", pale: "#E3ECE6" };

export default function McKinneyPackScreen() {
  const router = useRouter();
  return <SafeAreaView style={styles.safe} edges={["bottom"]}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>LOCATION PACK · FIELD TEST</Text>
    <Text style={styles.title}>{MCKINNEY_PACK.name}</Text>
    <Text style={styles.intro}>{MCKINNEY_PACK.description}</Text>
    <View style={styles.legend}><View><Text style={styles.legendValue}>{MCKINNEY_PACK.sites.length}</Text><Text style={styles.legendLabel}>SOURCE-BACKED SITES</Text></View><View style={styles.legendDivider} /><View><Text style={styles.legendValue}>0</Text><Text style={styles.legendLabel}>FIELD-VERIFIED</Text></View></View>
    <View style={styles.notice}><Text style={styles.noticeTitle}>What “field check” means</Text><Text style={styles.noticeText}>The history is sourced, but visual puzzle details must be confirmed in person before Homage treats them as answers.</Text></View>

    <View style={styles.list}>{MCKINNEY_PACK.sites.map((site, index) => <View key={site.id} style={styles.card}>
      <View style={styles.cardTop}><View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View><View style={styles.cardHeading}><Text style={styles.siteName}>{site.shortName}</Text><Text style={styles.address}>{site.address}</Text></View><View style={styles.verify}><Text style={styles.verifyText}>FIELD CHECK</Text></View></View>
      <Text style={styles.context}>{site.historicalContext}</Text>
      <View style={styles.observe}><Text style={styles.observeLabel}>LOOK FOR</Text><Text style={styles.observeText}>{site.publicObservation}</Text></View>
      <Text style={styles.seedLabel}>PUZZLE HOOK</Text><Text style={styles.seed}>{site.puzzleSeed}</Text>
      <View style={styles.tags}>{site.puzzleMechanics.map((mechanic) => <View key={mechanic} style={styles.tag}><Text style={styles.tagText}>{mechanic.toUpperCase()}</Text></View>)}</View>
      <Text style={styles.safety}>{site.safetyNote}</Text>
      <Pressable onPress={() => void Linking.openURL(site.sourceUrl)} style={styles.source}><Text style={styles.sourceText}>View source · {site.sourceLabel}</Text></Pressable>
    </View>)}</View>

    <Pressable onPress={() => router.push("/mckinney-simulation-lab")} style={styles.primary}><Text style={styles.primaryText}>Open Simulation Lab</Text></Pressable>
    <Pressable onPress={() => router.push("/mckinney-puzzle-lab")} style={styles.secondary}><Text style={styles.secondaryText}>Generate & Play</Text></Pressable>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 }, content: { padding: 20, paddingBottom: 50 }, eyebrow: { color: colors.green, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 }, title: { color: colors.ink, fontSize: 34, fontWeight: "900", letterSpacing: -.8, marginTop: 7 }, intro: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 9 }, legend: { alignItems: "center", backgroundColor: colors.green, borderRadius: 17, flexDirection: "row", justifyContent: "space-around", marginTop: 19, padding: 17 }, legendValue: { color: "#FFF", fontSize: 24, fontWeight: "900", textAlign: "center" }, legendLabel: { color: "#CDE5D4", fontSize: 8, fontWeight: "900", letterSpacing: 1, marginTop: 3 }, legendDivider: { backgroundColor: "#5B7F69", height: 38, width: 1 }, notice: { backgroundColor: "#FFF8E8", borderColor: "#ECD7A6", borderRadius: 14, borderWidth: 1, marginTop: 13, padding: 14 }, noticeTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" }, noticeText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }, list: { gap: 12, marginTop: 18 }, card: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: 17, borderWidth: 1, padding: 16 }, cardTop: { alignItems: "center", flexDirection: "row" }, number: { alignItems: "center", backgroundColor: colors.pale, borderRadius: 17, height: 34, justifyContent: "center", width: 34 }, numberText: { color: colors.green, fontWeight: "900" }, cardHeading: { flex: 1, marginLeft: 10 }, siteName: { color: colors.ink, fontSize: 16, fontWeight: "900" }, address: { color: colors.muted, fontSize: 11, marginTop: 3 }, verify: { backgroundColor: "#F4E8CB", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5 }, verifyText: { color: "#8A641C", fontSize: 7, fontWeight: "900", letterSpacing: .7 }, context: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 13 }, observe: { backgroundColor: colors.pale, borderRadius: 11, marginTop: 11, padding: 11 }, observeLabel: { color: colors.green, fontSize: 8, fontWeight: "900", letterSpacing: 1 }, observeText: { color: colors.ink, fontSize: 12, lineHeight: 18, marginTop: 4 }, seedLabel: { color: colors.gold, fontSize: 8, fontWeight: "900", letterSpacing: 1, marginTop: 12 }, seed: { color: colors.ink, fontSize: 12, lineHeight: 18, marginTop: 4 }, tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 11 }, tag: { borderColor: colors.line, borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 }, tagText: { color: colors.green, fontSize: 8, fontWeight: "900" }, safety: { color: colors.muted, fontSize: 10, fontStyle: "italic", lineHeight: 15, marginTop: 11 }, source: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 12, paddingTop: 11 }, sourceText: { color: colors.green, fontSize: 11, fontWeight: "800" }, primary: { alignItems: "center", backgroundColor: colors.green, borderRadius: 14, marginTop: 18, padding: 15 }, primaryText: { color: "#FFF", fontSize: 14, fontWeight: "900" }, secondary: { alignItems: "center", borderColor: colors.green, borderRadius: 14, borderWidth: 1, marginTop: 9, padding: 13 }, secondaryText: { color: colors.green, fontSize: 13, fontWeight: "900" },
});
