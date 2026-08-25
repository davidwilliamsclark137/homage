import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

const colors = { cream: "#F8F5EC", ink: "#17241D", muted: "#627067", green: "#275D45", pale: "#E3ECE6", gold: "#E0A43A", white: "#FFFFFF" };

export default function CoverScreen() {
  const router = useRouter();
  return <SafeAreaView style={styles.safe}>
    <View style={styles.field}>
      <View style={styles.orbitLarge} /><View style={styles.orbitSmall} />
      <View style={styles.signal}><View style={styles.signalCore} /></View>
      <Text style={styles.name}>HOMAGE</Text>
      <Text style={styles.tagline}>The world is full of hidden signals.</Text>
      <Text style={styles.copy}>Explore public places, solve location puzzles, and leave encrypted discoveries for another player.</Text>
    </View>
    <View style={styles.actions}>
      <Pressable onPress={() => router.push("/explore")} style={styles.primary}><Text style={styles.primaryText}>Enter the field</Text></Pressable>
      <Pressable onPress={() => router.push("/mckinney-puzzle-lab")} style={styles.secondary}><Text style={styles.secondaryText}>Preview McKinney puzzles</Text></Pressable>
      <Pressable onPress={() => router.push("/nine-portals")} style={styles.secondary}><Text style={styles.secondaryText}>Open the nine portals</Text></Pressable>
      <Pressable onPress={() => router.push("/message-hunt")} style={styles.tertiary}><Text style={styles.tertiaryText}>Join a two-player game</Text></Pressable>
      <Text style={styles.note}>Location-aware exploration · public spaces only</Text>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.cream, flex: 1 }, field: { alignItems: "center", flex: 1, justifyContent: "center", overflow: "hidden", paddingHorizontal: 34, position: "relative" }, orbitLarge: { borderColor: "rgba(39,93,69,.12)", borderRadius: 170, borderWidth: 1, height: 340, position: "absolute", width: 340 }, orbitSmall: { borderColor: "rgba(39,93,69,.18)", borderRadius: 105, borderWidth: 1, height: 210, position: "absolute", width: 210 }, signal: { alignItems: "center", backgroundColor: "rgba(90,196,122,.18)", borderRadius: 34, height: 68, justifyContent: "center", marginBottom: 30, width: 68 }, signalCore: { backgroundColor: colors.green, borderColor: colors.white, borderRadius: 13, borderWidth: 4, height: 26, width: 26 }, name: { color: colors.ink, fontSize: 43, fontWeight: "900", letterSpacing: 7 }, tagline: { color: colors.green, fontSize: 18, fontWeight: "800", lineHeight: 25, marginTop: 15, textAlign: "center" }, copy: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 12, maxWidth: 330, textAlign: "center" }, actions: { padding: 22, paddingBottom: 17 }, primary: { alignItems: "center", backgroundColor: colors.green, borderRadius: 15, padding: 16 }, primaryText: { color: colors.white, fontSize: 15, fontWeight: "900" }, secondary: { alignItems: "center", backgroundColor: colors.pale, borderRadius: 15, marginTop: 9, padding: 14 }, secondaryText: { color: colors.green, fontSize: 13, fontWeight: "900" }, tertiary: { alignItems: "center", marginTop: 3, padding: 13 }, tertiaryText: { color: colors.muted, fontSize: 12, fontWeight: "800" }, note: { color: "#899188", fontSize: 9, letterSpacing: .4, marginTop: 5, textAlign: "center" },
});
