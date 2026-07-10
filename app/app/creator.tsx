import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  CommunityQuest,
  createCustomQuest,
  getCustomQuests,
} from "../api";
import {
  getMultiplayerProfile,
  MultiplayerProfile,
} from "../lib/multiplayerSession";
import { useStationaryAuthoringLocation } from "../hooks/useStationaryAuthoringLocation";
import { RGB_THEME } from "../lib/theme";

type Category = "observation" | "photography" | "sound" | "sky";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "observation", label: "Observe" },
  { id: "photography", label: "Photo" },
  { id: "sound", label: "Listen" },
  { id: "sky", label: "Sky" },
];

export default function QuestCreatorScreen() {
  const [profile, setProfile] = useState<MultiplayerProfile | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("observation");
  const [safeAreaConfirmed, setSafeAreaConfirmed] = useState(false);
  const [published, setPublished] = useState<CommunityQuest[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const {
    accuracy,
    error: locationError,
    gpsReady,
    loading: locationLoading,
    location,
    stationaryFixes,
    status,
  } = useStationaryAuthoringLocation();

  useEffect(() => {
    let active = true;

    getMultiplayerProfile()
      .then((nextProfile) => {
        if (!active) return;
        setProfile(nextProfile);
        return getCustomQuests(nextProfile.playerId);
      })
      .then((response) => {
        if (active && response) setPublished(response.quests);
      })
      .catch((caught) => {
        if (active) setError(errorMessage(caught));
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!gpsReady) setSafeAreaConfirmed(false);
  }, [gpsReady]);

  const formReady =
    Boolean(profile) &&
    gpsReady &&
    safeAreaConfirmed &&
    name.trim().length >= 3 &&
    description.trim().length >= 10;

  async function publishQuest() {
    if (!formReady || !location || !profile || accuracy === null) return;
    setPublishing(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await createCustomQuest({
        player_id: profile.playerId,
        player_name: profile.playerName,
        name: name.trim(),
        description: description.trim(),
        category,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy,
        stationary_fixes: stationaryFixes,
        safe_area_confirmed: true,
      });
      setPublished((current) => [response.quest, ...current]);
      setSuccess(`${response.quest.name} is now available nearby.`);
      setName("");
      setDescription("");
      setSafeAreaConfirmed(false);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPublishing(false);
    }
  }

  if (profileLoading || locationLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={RGB_THEME.cyan} />
        <Text style={styles.loadingText}>Preparing Quest Studio...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={["bottom"]} style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headingRow}>
            <View>
              <Text style={styles.kicker}>COMMUNITY QUESTS</Text>
              <Text style={styles.title}>Quest Studio</Text>
            </View>
            <Text style={[styles.gps, gpsReady && styles.gpsReady]}>
              {status}
            </Text>
          </View>

          <Text style={styles.label}>Quest name</Text>
          <TextInput
            maxLength={60}
            onChangeText={setName}
            placeholder="Horizon colors"
            placeholderTextColor={RGB_THEME.dim}
            style={styles.input}
            value={name}
          />

          <Text style={styles.label}>Activity</Text>
          <View style={styles.segmented}>
            {CATEGORIES.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => setCategory(option.id)}
                style={[
                  styles.segment,
                  category === option.id && styles.segmentActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    category === option.id && styles.segmentTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Prompt</Text>
          <TextInput
            maxLength={240}
            multiline
            onChangeText={setDescription}
            placeholder="Photograph two colors meeting at the horizon."
            placeholderTextColor={RGB_THEME.dim}
            style={[styles.input, styles.prompt]}
            textAlignVertical="top"
            value={description}
          />
          <Text style={styles.counter}>{description.length}/240</Text>

          <View style={styles.safetyRow}>
            <View style={styles.safetyText}>
              <Text style={styles.safetyTitle}>Safe public location</Text>
              <Text style={styles.safetyCopy}>
                I am in a designated parking or pedestrian area, away from
                pumps, drive lanes, roads, and shoulders, and allowed to
                publish here.
              </Text>
            </View>
            <Switch
              disabled={!gpsReady}
              onValueChange={setSafeAreaConfirmed}
              ios_backgroundColor={RGB_THEME.border}
              thumbColor={
                safeAreaConfirmed ? RGB_THEME.lime : RGB_THEME.muted
              }
              trackColor={{
                false: RGB_THEME.border,
                true: RGB_THEME.surfaceRaised,
              }}
              value={safeAreaConfirmed}
            />
          </View>

          {locationError ? (
            <Text style={styles.error}>{locationError}</Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>{success}</Text> : null}

          <Pressable
            disabled={!formReady || publishing}
            onPress={() => void publishQuest()}
            style={[
              styles.publishButton,
              (!formReady || publishing) && styles.disabled,
            ]}
          >
            {publishing ? (
              <ActivityIndicator color={RGB_THEME.black} />
            ) : (
              <Text style={styles.publishText}>Publish at this location</Text>
            )}
          </Pressable>

          <View style={styles.listHeading}>
            <Text style={styles.listTitle}>Your published quests</Text>
            <Text style={styles.listCount}>{published.length}</Text>
          </View>
          {published.length ? (
            published.map((quest) => (
              <View key={quest.id} style={styles.questRow}>
                <View style={styles.questText}>
                  <Text style={styles.questName}>{quest.name}</Text>
                  <Text numberOfLines={2} style={styles.questPrompt}>
                    {quest.description}
                  </Text>
                </View>
                <Text style={styles.questCategory}>
                  {quest.category.toUpperCase()}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>No community quests published yet.</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { backgroundColor: RGB_THEME.background, flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  center: {
    alignItems: "center",
    backgroundColor: RGB_THEME.background,
    flex: 1,
    gap: 12,
    justifyContent: "center",
  },
  loadingText: { color: RGB_THEME.muted, fontSize: 14 },
  headingRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  kicker: { color: RGB_THEME.magenta, fontSize: 11, fontWeight: "900" },
  title: {
    color: RGB_THEME.text,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4,
  },
  gps: {
    color: RGB_THEME.amber,
    fontSize: 11,
    fontWeight: "800",
    maxWidth: 130,
    textAlign: "right",
  },
  gpsReady: { color: RGB_THEME.lime },
  label: {
    color: RGB_THEME.muted,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 7,
    marginTop: 16,
  },
  input: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    color: RGB_THEME.text,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  prompt: { minHeight: 112, paddingTop: 13 },
  counter: {
    color: RGB_THEME.dim,
    fontSize: 11,
    marginTop: 5,
    textAlign: "right",
  },
  segmented: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  segment: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  segmentActive: { backgroundColor: RGB_THEME.magenta },
  segmentText: { color: RGB_THEME.muted, fontSize: 12, fontWeight: "800" },
  segmentTextActive: { color: RGB_THEME.black },
  safetyRow: {
    alignItems: "center",
    borderBottomColor: RGB_THEME.border,
    borderBottomWidth: 1,
    borderTopColor: RGB_THEME.border,
    borderTopWidth: 1,
    flexDirection: "row",
    marginTop: 20,
    paddingVertical: 15,
  },
  safetyText: { flex: 1, paddingRight: 16 },
  safetyTitle: { color: RGB_THEME.text, fontSize: 14, fontWeight: "800" },
  safetyCopy: {
    color: RGB_THEME.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  error: { color: RGB_THEME.danger, fontSize: 13, marginTop: 12 },
  success: { color: RGB_THEME.lime, fontSize: 13, marginTop: 12 },
  publishButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.lime,
    borderRadius: 4,
    justifyContent: "center",
    marginTop: 18,
    minHeight: 52,
  },
  publishText: { color: RGB_THEME.black, fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.4 },
  listHeading: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 34,
    paddingBottom: 8,
  },
  listTitle: { color: RGB_THEME.text, fontSize: 18, fontWeight: "900" },
  listCount: { color: RGB_THEME.magenta, fontSize: 13, fontWeight: "800" },
  questRow: {
    alignItems: "flex-start",
    borderTopColor: RGB_THEME.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingVertical: 14,
  },
  questText: { flex: 1, minWidth: 0 },
  questName: { color: RGB_THEME.text, fontSize: 15, fontWeight: "800" },
  questPrompt: {
    color: RGB_THEME.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  questCategory: {
    color: RGB_THEME.magenta,
    fontSize: 9,
    fontWeight: "900",
    maxWidth: 90,
  },
  empty: {
    borderTopColor: RGB_THEME.border,
    borderTopWidth: 1,
    color: RGB_THEME.muted,
    fontSize: 13,
    paddingVertical: 18,
  },
});
