import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import {
  API_BASE,
  findHiddenSignal,
  GeneratedQuest,
  lockHideSeekSky,
  markHiddenSignalReady,
  MultiplayerRoom,
  selectHidingPlace,
  updateSeekerPosition,
  uploadForm,
} from "../api";
import { addArtifact, persistArtifactImage } from "../lib/artifacts";
import { haversine, LatLng } from "../lib/geo";
import { RGB_THEME } from "../lib/theme";
import {
  collectMelody,
  MelodyDrop,
  melodySeed,
  moodForCategory,
} from "../lib/melodyCollection";
import { ActiveMultiplayerSession } from "./MultiplayerLobby";
import PhotoReviewModal, { PhotoTreatment } from "./PhotoReviewModal";
import QuestRadar from "./QuestRadar";
import SkyQuestModal from "./SkyQuestModal";

type Props = {
  session: ActiveMultiplayerSession;
  location: LatLng;
  locationAccuracy: number | null;
  safeAreaConfirmed: boolean;
  stationaryFixes: number;
  onConfirmSafeArea: () => void;
  onRoom: (room: MultiplayerRoom) => void;
  onLeave: () => void;
};

type PendingClue = {
  uri: string;
  width: number;
  height: number;
};

export default function HideSeekGame({
  session,
  location,
  locationAccuracy,
  safeAreaConfirmed,
  stationaryFixes,
  onConfirmSafeArea,
  onRoom,
  onLeave,
}: Props) {
  const player = session.room.players.find(
    (candidate) => candidate.id === session.playerId,
  );
  const hide = session.room.hide_seek;
  const isHider = player?.role === "hider";
  const isSeeker = player?.role === "seeker";
  const selectedTarget = hide?.selected_quest ?? null;
  const [pendingClue, setPendingClue] = useState<PendingClue | null>(null);
  const [skyOpen, setSkyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastPositionSent = useRef(0);
  const melodyPlayer = useAudioPlayer(null);
  const mySkyLocked = Boolean(hide?.sky_by.includes(session.playerId));
  const requiresSafeAreaConfirmation = Boolean(
    selectedTarget?.requires_safe_area_confirmation ??
      hide?.requires_safe_area_confirmation,
  );

  const selectedDistance = useMemo(
    () =>
      selectedTarget
        ? haversine(location, {
            latitude: selectedTarget.latitude,
            longitude: selectedTarget.longitude,
          })
        : null,
    [location, selectedTarget],
  );

  useEffect(() => {
    if (
      !isSeeker ||
      !hide?.ready ||
      hide.found ||
      locationAccuracy === null ||
      locationAccuracy > 35 ||
      Date.now() - lastPositionSent.current < 2_500
    ) {
      return;
    }

    lastPositionSent.current = Date.now();
    updateSeekerPosition(session.room.code, {
      player_id: session.playerId,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: locationAccuracy,
    })
      .then(onRoom)
      .catch((caught) => setError(errorMessage(caught)));
  }, [
    hide?.found,
    hide?.ready,
    isSeeker,
    location.latitude,
    location.longitude,
    locationAccuracy,
    onRoom,
    session.playerId,
    session.room.code,
  ]);

  async function chooseTarget(target: GeneratedQuest) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const room = await selectHidingPlace(
        session.room.code,
        session.playerId,
        target.id,
      );
      onRoom(room);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function takeCluePhoto() {
    if (!selectedTarget || busy) return;
    if (requiresSafeAreaConfirmation && !safeAreaConfirmed) {
      onConfirmSafeArea();
      return;
    }
    if (
      selectedDistance === null ||
      selectedDistance > selectedTarget.radius
    ) {
      Alert.alert(
        "Reach the hiding place",
        "Enter the destination radius before planting the signal.",
      );
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Camera needed", "Allow camera access to create the clue.");
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (shot.canceled) return;
    const asset = shot.assets[0];
    setPendingClue({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
    });
  }

  async function saveClue(
    processedUri: string,
    treatment: PhotoTreatment,
  ) {
    if (!selectedTarget || !pendingClue) return;
    const form = new FormData();
    form.append("file", {
      uri: processedUri,
      name: `hide-${session.room.code}-${Date.now()}.jpg`,
      type: "image/jpeg",
    } as any);
    form.append("quest_id", `hide-${session.room.code}`);
    form.append("quest_name", "Hidden signal clue");
    form.append("quest_description", "A processed clue for Hide & Seek.");
    form.append("quest_kind", "photo");
    form.append("treatment", treatment);
    form.append("room_code", session.room.code);
    form.append("player_id", session.playerId);

    const upload = await uploadForm(form);
    const photoUrl =
      typeof upload?.metadata?.file_url === "string"
        ? upload.metadata.file_url
        : undefined;
    const persistentImageUri = await persistArtifactImage(
      processedUri,
      `hide-${session.room.code}`,
    );
    const persistentOriginalUri =
      treatment === "original"
        ? persistentImageUri
        : await persistArtifactImage(
            pendingClue.uri,
            `hide-${session.room.code}-original`,
          );
    await addArtifact({
      questId: `hide-${session.room.code}`,
      questName: "Hidden signal clue",
      questDescription: "A clue planted for the Seeker.",
      category: selectedTarget.category,
      kind: "photo",
      source: "multiplayer-hide-seek",
      latitude: location.latitude,
      longitude: location.longitude,
      imageUri: persistentImageUri,
      originalImageUri: persistentOriginalUri,
      treatment,
    });

    const melody = await collectMelody(hiddenMelodyDrop(
      session.room.code,
      selectedTarget,
    ));
    melodyPlayer.replace({ uri: melody.uri });
    melodyPlayer.play();

    const room = await markHiddenSignalReady(session.room.code, {
      player_id: session.playerId,
      photo_url: photoUrl,
      treatment,
      safe_area_confirmed: safeAreaConfirmed,
    });
    setPendingClue(null);
    onRoom(room);
    Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
    Alert.alert(
      "Signal planted",
      "The Seeker now has the photo clue and hot/cold tracking.",
    );
  }

  async function recoverSignal() {
    if (!hide?.can_find || busy) return;
    setBusy(true);
    setError(null);
    try {
      const drop: MelodyDrop = {
        id: `hide-${session.room.code}`,
        latitude: location.latitude,
        longitude: location.longitude,
        locationName: `Room ${session.room.code} hidden signal`,
        mood: "arcade",
        seed: melodySeed(`hide-${session.room.code}`),
      };
      const melody = await collectMelody(drop);
      melodyPlayer.replace({ uri: melody.uri });
      melodyPlayer.play();
      const room = await findHiddenSignal(
        session.room.code,
        session.playerId,
        safeAreaConfirmed,
      );
      onRoom(room);
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function completeSky(targetName: string) {
    setBusy(true);
    setError(null);
    try {
      const room = await lockHideSeekSky(
        session.room.code,
        session.playerId,
      );
      onRoom(room);
      setSkyOpen(false);
      Alert.alert(
        room.status === "complete"
          ? "Hide & Seek complete"
          : "Your sky signal is locked",
        room.status === "complete"
          ? `Both players connected the hidden melody, clue, and ${targetName}.`
          : "Waiting for the other player to lock the sky.",
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (!hide || !player) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={RGB_THEME.cyan} />
      </View>
    );
  }

  if (session.room.status === "complete") {
    return (
      <View style={styles.complete}>
        <Text style={styles.kicker}>HIDDEN SIGNAL FOUND</Text>
        <Text style={styles.completeTitle}>Hide & Seek complete</Text>
        <Text style={styles.copy}>
          The clue, melody, discovery, and both sky locks are connected.
        </Text>
        <Pressable onPress={onLeave} style={styles.primaryButton}>
          <Text style={styles.primaryText}>Return to room lobby</Text>
        </Pressable>
      </View>
    );
  }

  if (hide.found) {
    return (
      <View style={styles.complete}>
        <SkyQuestModal
          onClose={() => setSkyOpen(false)}
          onComplete={(name) => void completeSky(name)}
          placeName="the hidden signal"
          visible={skyOpen}
        />
        <Text style={styles.kicker}>SIGNAL RECOVERED</Text>
        <Text style={styles.completeTitle}>Lock the shared sky</Text>
        <Text style={styles.copy}>
          {mySkyLocked
            ? "Your sky lock is complete. Waiting for the other player."
            : "Both players must independently align the Sun or visible constellation."}
        </Text>
        {!mySkyLocked ? (
          <Pressable
            disabled={busy}
            onPress={() => setSkyOpen(true)}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryText}>Open sky lens</Text>
          </Pressable>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable onPress={onLeave} style={styles.linkButton}>
          <Text style={styles.linkText}>Leave room</Text>
        </Pressable>
      </View>
    );
  }

  if (isHider) {
    if (!selectedTarget) {
      return (
        <ScrollView
          contentContainerStyle={styles.selection}
          style={styles.lightScreen}
        >
          <Text style={styles.kicker}>HIDER · ROOM {session.room.code}</Text>
          <Text style={styles.title}>Choose a public hiding place</Text>
          <Text style={styles.copy}>
            The Seeker will not receive its coordinates. You must travel there
            and create the photo clue.
          </Text>
          {session.room.quests.map((target) => (
            <Pressable
              key={target.id}
              disabled={busy}
              onPress={() => void chooseTarget(target)}
              style={styles.placeRow}
            >
              <View style={styles.placeText}>
                <Text style={styles.placeName}>{target.name}</Text>
                <Text style={styles.placeDistance}>
                  {target.distance_m} m away · {target.category.replaceAll("_", " ")}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable onPress={onLeave} style={styles.linkButton}>
            <Text style={styles.linkText}>Leave room</Text>
          </Pressable>
        </ScrollView>
      );
    }

    return (
      <View style={styles.radarScreen}>
        <PhotoReviewModal
          onCancel={() => setPendingClue(null)}
          onRetake={() => {
            setPendingClue(null);
            void takeCluePhoto();
          }}
          onSave={saveClue}
          photo={pendingClue}
          questName="Hidden signal clue"
        />
        <QuestRadar
          inRange={
            selectedDistance !== null &&
            selectedDistance <= selectedTarget.radius
          }
          location={location}
          melodyCollected={hide.ready}
          target={selectedTarget}
        />
        <View style={styles.panel}>
          <Text style={styles.kicker}>HIDER · ROOM {session.room.code}</Text>
          <Text style={styles.panelTitle}>{selectedTarget.name}</Text>
          <Text style={styles.panelCopy}>
            {hide.ready
              ? "Signal planted. Stay nearby or explore while the Seeker follows the clue."
              : "Reach this public landmark, photograph a useful detail, and plant its melody."}
          </Text>
          {requiresSafeAreaConfirmation && !safeAreaConfirmed ? (
            <>
              <Text style={styles.safetyCopy}>
                Stay fully off roads and shoulders. This activity remains at
                your current safe location.
              </Text>
              <Pressable
                disabled={stationaryFixes < 3}
                onPress={onConfirmSafeArea}
                style={[
                  styles.confirmButton,
                  stationaryFixes < 3 && styles.disabled,
                ]}
              >
                <Text style={styles.confirmText}>
                  {stationaryFixes >= 3
                    ? "Confirm safe area"
                    : `Hold still (${Math.min(stationaryFixes, 3)}/3)`}
                </Text>
              </Pressable>
            </>
          ) : null}
          {!hide.ready ? (
            <Pressable
              disabled={
                selectedDistance === null ||
                selectedDistance > selectedTarget.radius ||
                (requiresSafeAreaConfirmation && !safeAreaConfirmed)
              }
              onPress={() => void takeCluePhoto()}
              style={[
                styles.primaryButton,
                (selectedDistance === null ||
                  selectedDistance > selectedTarget.radius ||
                  (requiresSafeAreaConfirmation && !safeAreaConfirmed)) &&
                  styles.disabled,
              ]}
            >
              <Text style={styles.primaryText}>
                {selectedDistance !== null &&
                selectedDistance <= selectedTarget.radius
                  ? "Plant photo clue"
                  : "Get closer"}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.waitingRow}>
              <ActivityIndicator color={RGB_THEME.cyan} />
              <Text style={styles.waitingText}>Waiting for the Seeker</Text>
            </View>
          )}
          <Pressable onPress={onLeave} style={styles.linkButton}>
            <Text style={styles.linkText}>Leave room</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!hide.ready) {
    return (
      <View style={styles.complete}>
        <ActivityIndicator color={RGB_THEME.cyan} />
        <Text style={styles.completeTitle}>The Hider is planting a signal</Text>
        <Text style={styles.copy}>
          You will receive a photo clue and hot/cold reading when it is ready.
        </Text>
        <Pressable onPress={onLeave} style={styles.linkButton}>
          <Text style={styles.linkText}>Leave room</Text>
        </Pressable>
      </View>
    );
  }

  const clueUrl = hide.photo_url
    ? hide.photo_url.startsWith("http")
      ? hide.photo_url
      : `${API_BASE}${hide.photo_url}`
    : null;

  return (
    <ScrollView
      contentContainerStyle={styles.seeker}
      style={styles.darkScreen}
    >
      <Text style={styles.darkKicker}>SEEKER · ROOM {session.room.code}</Text>
      <Text style={styles.darkTitle}>Find the hidden signal</Text>
      {clueUrl ? (
        <Image source={{ uri: clueUrl }} style={styles.clueImage} />
      ) : null}
      <View style={styles.temperatureBlock}>
        <Text style={styles.temperature}>
          {(hide.temperature ?? "searching").toUpperCase()}
        </Text>
        <Text style={styles.trend}>
          {hide.trend === "warmer"
            ? "You are getting warmer"
            : hide.trend === "colder"
              ? "You are getting colder"
              : hide.distance_m === null
                ? "Establishing your first reading"
                : "Move at least 10 meters for a new reading"}
        </Text>
      </View>
      <Text style={styles.privacyCopy}>
        Exact coordinates are hidden. Readings update from your local GPS
        approximately every three seconds.
      </Text>
      {requiresSafeAreaConfirmation && !safeAreaConfirmed ? (
        <>
          <Text style={styles.darkSafetyCopy}>
            Before recovering the signal, stop in a permitted pedestrian area
            fully away from roads and shoulders.
          </Text>
          <Pressable
            disabled={stationaryFixes < 3}
            onPress={onConfirmSafeArea}
            style={[
              styles.findButton,
              stationaryFixes < 3 && styles.disabled,
            ]}
          >
            <Text style={styles.findText}>
              {stationaryFixes >= 3
                ? "Confirm safe area"
                : `Hold still (${Math.min(stationaryFixes, 3)}/3)`}
            </Text>
          </Pressable>
        </>
      ) : null}
      {hide.can_find ? (
        <Pressable
          disabled={
            busy ||
            (requiresSafeAreaConfirmation && !safeAreaConfirmed)
          }
          onPress={() => void recoverSignal()}
          style={styles.findButton}
        >
          <Text style={styles.findText}>Recover melody</Text>
        </Pressable>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable onPress={onLeave} style={styles.darkLinkButton}>
        <Text style={styles.darkLinkText}>Leave room</Text>
      </Pressable>
    </ScrollView>
  );
}

function hiddenMelodyDrop(code: string, target: GeneratedQuest): MelodyDrop {
  const id = `hide-${code}`;
  return {
    id,
    latitude: target.latitude,
    longitude: target.longitude,
    locationName: `Room ${code} hidden signal`,
    mood: moodForCategory(target.category),
    seed: melodySeed(id),
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    backgroundColor: RGB_THEME.background,
    flex: 1,
    justifyContent: "center",
  },
  lightScreen: { backgroundColor: RGB_THEME.background },
  darkScreen: { backgroundColor: RGB_THEME.background },
  selection: { padding: 24, paddingBottom: 48 },
  kicker: { color: RGB_THEME.magenta, fontSize: 11, fontWeight: "900" },
  title: {
    color: RGB_THEME.text,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 7,
  },
  copy: { color: RGB_THEME.muted, fontSize: 15, lineHeight: 22, marginTop: 10 },
  placeRow: {
    alignItems: "center",
    borderBottomColor: RGB_THEME.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 72,
  },
  placeText: { flex: 1, minWidth: 0 },
  placeName: { color: RGB_THEME.text, fontSize: 16, fontWeight: "800" },
  placeDistance: {
    color: RGB_THEME.muted,
    fontSize: 12,
    marginTop: 4,
    textTransform: "capitalize",
  },
  chevron: { color: RGB_THEME.cyan, fontSize: 28, paddingHorizontal: 8 },
  radarScreen: { backgroundColor: RGB_THEME.background, flex: 1 },
  panel: {
    backgroundColor: "rgba(23,26,31,0.96)",
    borderColor: RGB_THEME.borderStrong,
    borderWidth: 1,
    borderRadius: 8,
    bottom: 24,
    gap: 8,
    left: 16,
    padding: 16,
    position: "absolute",
    right: 16,
  },
  panelTitle: { color: RGB_THEME.text, fontSize: 20, fontWeight: "900" },
  panelCopy: { color: RGB_THEME.muted, fontSize: 14, lineHeight: 20 },
  primaryButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.magenta,
    borderRadius: 4,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 50,
  },
  primaryText: { color: RGB_THEME.black, fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.42 },
  safetyCopy: {
    color: RGB_THEME.amber,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  confirmButton: {
    alignItems: "center",
    borderColor: RGB_THEME.amber,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 46,
  },
  confirmText: { color: RGB_THEME.amber, fontSize: 14, fontWeight: "800" },
  waitingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 48,
  },
  waitingText: { color: RGB_THEME.muted, fontSize: 14, fontWeight: "700" },
  linkButton: { alignItems: "center", minHeight: 44, paddingTop: 14 },
  linkText: { color: RGB_THEME.muted, fontSize: 13, fontWeight: "700" },
  complete: {
    backgroundColor: RGB_THEME.background,
    flex: 1,
    justifyContent: "center",
    padding: 28,
  },
  completeTitle: {
    color: RGB_THEME.text,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 8,
  },
  seeker: { padding: 22, paddingBottom: 48 },
  darkKicker: { color: RGB_THEME.cyan, fontSize: 11, fontWeight: "900" },
  darkTitle: {
    color: RGB_THEME.text,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 7,
  },
  darkSafetyCopy: {
    color: RGB_THEME.amber,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 18,
  },
  clueImage: {
    aspectRatio: 1,
    backgroundColor: RGB_THEME.surface,
    borderRadius: 6,
    marginTop: 20,
    width: "100%",
  },
  temperatureBlock: {
    borderBottomColor: RGB_THEME.border,
    borderBottomWidth: 1,
    borderTopColor: RGB_THEME.border,
    borderTopWidth: 1,
    marginTop: 22,
    paddingVertical: 18,
  },
  temperature: { color: RGB_THEME.lime, fontSize: 30, fontWeight: "900" },
  trend: { color: RGB_THEME.text, fontSize: 15, marginTop: 4 },
  privacyCopy: {
    color: RGB_THEME.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },
  findButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.cyan,
    borderRadius: 4,
    justifyContent: "center",
    marginTop: 20,
    minHeight: 54,
  },
  findText: { color: RGB_THEME.black, fontSize: 16, fontWeight: "900" },
  darkLinkButton: { alignItems: "center", minHeight: 48, paddingTop: 20 },
  darkLinkText: { color: RGB_THEME.muted, fontSize: 13, fontWeight: "700" },
  error: { color: RGB_THEME.danger, fontSize: 13, marginTop: 12 },
});
