import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

import { API_BASE, getCompleted } from "../api";
import { Artifact, getArtifacts } from "../lib/artifacts";
import { RGB_THEME } from "../lib/theme";

export default function ArtifactsScreen() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const local = await getArtifacts();
    let remote: Artifact[] = [];

    try {
      const response = await getCompleted();
      const localQuestIds = new Set(local.map((artifact) => artifact.questId));
      remote = (response.completed ?? [])
        .map(remoteRecordToArtifact)
        .filter(
          (artifact): artifact is Artifact =>
            artifact !== null && !localQuestIds.has(artifact.questId),
        );
    } catch {
      // Local artifacts remain available when the backend is offline.
    }

    setArtifacts(
      [...local, ...remote].sort((first, second) =>
        second.capturedAt.localeCompare(first.capturedAt),
      ),
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      load()
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={artifacts}
      keyExtractor={(artifact) => artifact.id}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={[
        styles.collection,
        !artifacts.length && styles.emptyCollection,
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} />
      }
      ListHeaderComponent={
        artifacts.length ? (
          <View style={styles.header}>
            <Text style={styles.title}>Artifacts</Text>
            <Text style={styles.count}>
              {artifacts.length} {artifacts.length === 1 ? "memory" : "memories"}
            </Text>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyMark}>A</Text>
          <Text style={styles.emptyTitle}>No artifacts yet</Text>
          <Text style={styles.emptyCopy}>
            Completed quests leave memories here.
          </Text>
        </View>
      }
      renderItem={({ item }) => <ArtifactTile artifact={item} />}
    />
  );
}

function ArtifactTile({ artifact }: { artifact: Artifact }) {
  const songPlayer = useAudioPlayer(artifact.songUri ?? null);
  const songStatus = useAudioPlayerStatus(songPlayer);
  const isDocument = artifact.kind === "document";
  const isSong = artifact.kind === "song";

  async function viewDocument() {
    if (artifact.documentRemoteUrl) {
      try {
        await Linking.openURL(artifact.documentRemoteUrl);
        return;
      } catch {
        // Fall through to the persistent local copy.
      }
    }
    await exportDocument();
  }

  async function exportDocument() {
    if (!artifact.documentUri) {
      Alert.alert("PDF unavailable", "This artifact has no saved PDF copy.");
      return;
    }
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert(
        "Sharing unavailable",
        "This phone cannot open the document export menu.",
      );
      return;
    }
    await Sharing.shareAsync(artifact.documentUri, {
      dialogTitle: artifact.questName,
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
    });
  }

  async function playSong() {
    if (!artifact.songUri) {
      Alert.alert("Song unavailable", "This artifact has no saved audio copy.");
      return;
    }
    await songPlayer.seekTo(0);
    songPlayer.play();
  }

  async function exportSong() {
    if (!artifact.songUri) {
      Alert.alert("Song unavailable", "This artifact has no saved audio copy.");
      return;
    }
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert("Sharing unavailable", "This phone cannot open the export menu.");
      return;
    }
    await Sharing.shareAsync(artifact.songUri, {
      dialogTitle: artifact.questName,
      mimeType: "audio/wav",
      UTI: "com.microsoft.waveform-audio",
    });
  }

  return (
    <View style={styles.tile}>
      {isDocument ? (
        <View style={styles.documentCover}>
          <View style={styles.documentSignal} />
          <Text style={styles.documentMark}>PDF</Text>
          <Text numberOfLines={2} style={styles.documentKind}>
            {(artifact.documentKind ?? "document").replaceAll("_", " ")}
          </Text>
        </View>
      ) : isSong ? (
        <View style={styles.songCover}>
          <View style={styles.songBars}>
            {[18, 42, 28, 56, 34, 48, 22, 38].map((height, index) => (
              <View
                key={index}
                style={[
                  styles.songBar,
                  {
                    backgroundColor:
                      index % 3 === 0
                        ? RGB_THEME.cyan
                        : index % 3 === 1
                          ? RGB_THEME.magenta
                          : RGB_THEME.lime,
                    height,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.songMark}>8-BIT</Text>
          <Text numberOfLines={1} style={styles.songKey}>
            {artifact.song
              ? `${artifact.song.key} ${artifact.song.scale} / ${artifact.song.meter}`
              : "chip song"}
          </Text>
        </View>
      ) : artifact.imageUri ? (
        <Image source={{ uri: artifact.imageUri }} style={styles.image} />
      ) : (
        <View
          style={[
            styles.keepsake,
            { backgroundColor: categoryColor(artifact.category) },
          ]}
        >
          <Text style={styles.keepsakeMark}>
            {artifact.questName.slice(0, 1).toUpperCase()}
          </Text>
          <Text style={styles.keepsakeType}>{categoryName(artifact.category)}</Text>
        </View>
      )}
      <View style={styles.tileBody}>
        <Text style={styles.questName} numberOfLines={2}>
          {artifact.questName}
        </Text>
        <Text style={styles.date}>{formatDate(artifact.capturedAt)}</Text>
        {artifact.treatment && artifact.treatment !== "original" ? (
          <Text style={styles.treatment}>
            {artifact.treatment.replaceAll("-", " ")}
          </Text>
        ) : null}
        {isDocument ? (
          <>
            <Text style={styles.savedLabel}>SAVED LOCALLY</Text>
            <View style={styles.documentActions}>
              <Pressable
                accessibilityLabel={`View ${artifact.questName}`}
                onPress={() => void viewDocument()}
                style={styles.viewButton}
              >
                <Text style={styles.viewText}>View</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`Export ${artifact.questName}`}
                onPress={() => void exportDocument()}
                style={styles.exportButton}
              >
                <Text style={styles.exportText}>Export</Text>
              </Pressable>
            </View>
          </>
        ) : isSong ? (
          <>
            <Text style={styles.savedLabel}>PLAYABLE WAV</Text>
            <View style={styles.documentActions}>
              <Pressable
                accessibilityLabel={`Play ${artifact.questName}`}
                onPress={() => void playSong()}
                style={styles.viewButton}
              >
                <Text style={styles.viewText}>
                  {songStatus.playing ? "Replay" : "Play"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`Export ${artifact.questName}`}
                onPress={() => void exportSong()}
                style={styles.exportButton}
              >
                <Text style={styles.exportText}>Export</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

function remoteRecordToArtifact(record: Record<string, unknown>): Artifact | null {
  const questId = stringValue(record.quest_id);
  const filename = stringValue(record.filename);
  const timestamp = stringValue(record.timestamp);
  if (!questId || !filename || !timestamp) return null;
  const fileUrl = stringValue(record.file_url);

  return {
    id: `remote-${filename}`,
    questId,
    questName:
      stringValue(record.quest_name) ?? stringValue(record.quest_id) ?? "Quest",
    questDescription: stringValue(record.quest_description) ?? "",
    category: stringValue(record.quest_kind) ?? "memory",
    kind: "photo",
    source: "backend-upload",
    capturedAt: timestamp,
    latitude: numberValue(record.latitude),
    longitude: numberValue(record.longitude),
    treatment: stringValue(record.treatment) ?? undefined,
    imageUri: fileUrl
      ? fileUrl.startsWith("http")
        ? fileUrl
        : `${API_BASE}${fileUrl}`
      : undefined,
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

function categoryName(category: string) {
  return category.replaceAll("_", " ");
}

function categoryColor(category: string) {
  const colors: Record<string, string> = {
    public_art: RGB_THEME.magenta,
    historic: RGB_THEME.amber,
    viewpoint: RGB_THEME.cyan,
    park: RGB_THEME.lime,
    trail: "#77D957",
    water: "#35A7FF",
    bridge: "#B26BFF",
    orientation: "#8C7CFF",
    observation: "#FF8A4C",
    skyline: RGB_THEME.borderStrong,
    story: RGB_THEME.magenta,
    music: RGB_THEME.cyan,
  };
  return colors[category] ?? RGB_THEME.borderStrong;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: RGB_THEME.background },
  center: {
    alignItems: "center",
    backgroundColor: RGB_THEME.background,
    flex: 1,
    justifyContent: "center",
  },
  collection: { padding: 16, paddingBottom: 40 },
  emptyCollection: { flexGrow: 1 },
  row: { gap: 12 },
  header: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: { color: RGB_THEME.text, fontSize: 28, fontWeight: "800" },
  count: { color: RGB_THEME.cyan, fontSize: 13, fontWeight: "700" },
  tile: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    marginBottom: 12,
    maxWidth: "48.5%",
    overflow: "hidden",
  },
  image: {
    aspectRatio: 1,
    backgroundColor: RGB_THEME.surfaceRaised,
    width: "100%",
  },
  keepsake: {
    alignItems: "center",
    aspectRatio: 1,
    justifyContent: "center",
    padding: 12,
    width: "100%",
  },
  keepsakeMark: { color: RGB_THEME.black, fontSize: 44, fontWeight: "300" },
  keepsakeType: {
    color: RGB_THEME.black,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 8,
    textTransform: "uppercase",
  },
  tileBody: { minHeight: 72, padding: 10 },
  questName: { color: RGB_THEME.text, fontSize: 14, fontWeight: "800" },
  date: { color: RGB_THEME.muted, fontSize: 11, marginTop: 5 },
  treatment: {
    color: RGB_THEME.magenta,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 4,
    textTransform: "uppercase",
  },
  documentCover: {
    aspectRatio: 1,
    backgroundColor: RGB_THEME.black,
    justifyContent: "flex-end",
    padding: 14,
    width: "100%",
  },
  documentSignal: {
    backgroundColor: RGB_THEME.magenta,
    height: 3,
    left: 14,
    position: "absolute",
    right: 14,
    top: 14,
  },
  documentMark: {
    color: RGB_THEME.text,
    fontSize: 28,
    fontWeight: "300",
  },
  documentKind: {
    color: RGB_THEME.magenta,
    fontSize: 10,
    fontWeight: "900",
    marginTop: 6,
    textTransform: "uppercase",
  },
  songCover: {
    aspectRatio: 1,
    backgroundColor: "#080A0C",
    justifyContent: "flex-end",
    padding: 14,
    width: "100%",
  },
  songBars: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 4,
    left: 14,
    position: "absolute",
    right: 14,
    top: 20,
  },
  songBar: { borderRadius: 1, flex: 1, maxWidth: 12 },
  songMark: { color: RGB_THEME.text, fontSize: 24, fontWeight: "300" },
  songKey: {
    color: RGB_THEME.cyan,
    fontSize: 9,
    fontWeight: "900",
    marginTop: 5,
    textTransform: "uppercase",
  },
  savedLabel: {
    color: RGB_THEME.lime,
    fontSize: 9,
    fontWeight: "900",
    marginTop: 7,
  },
  documentActions: { flexDirection: "row", gap: 6, marginTop: 9 },
  viewButton: {
    alignItems: "center",
    borderColor: RGB_THEME.cyan,
    borderRadius: 3,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 34,
  },
  viewText: { color: RGB_THEME.cyan, fontSize: 11, fontWeight: "900" },
  exportButton: {
    alignItems: "center",
    borderColor: RGB_THEME.magenta,
    borderRadius: 3,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 34,
  },
  exportText: { color: RGB_THEME.magenta, fontSize: 11, fontWeight: "900" },
  empty: { alignItems: "center", margin: "auto", padding: 32 },
  emptyMark: {
    color: RGB_THEME.cyan,
    fontSize: 52,
    fontWeight: "300",
    marginBottom: 16,
  },
  emptyTitle: { color: RGB_THEME.text, fontSize: 20, fontWeight: "800" },
  emptyCopy: { color: RGB_THEME.muted, fontSize: 14, marginTop: 6 },
});
