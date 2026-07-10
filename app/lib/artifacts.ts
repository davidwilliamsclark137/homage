import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

import { ChipSong, renderChipSong, validateChipSong } from "./chipSong";

const STORAGE_KEY = "homage.artifacts.v1";
const MAX_ARTIFACTS = 200;

export type Artifact = {
  id: string;
  questId: string;
  questName: string;
  questDescription: string;
  category: string;
  kind: "checkin" | "photo" | "document" | "song";
  source: string;
  capturedAt: string;
  latitude: number;
  longitude: number;
  imageUri?: string;
  originalImageUri?: string;
  treatment?: string;
  documentId?: string;
  documentKind?: "poem" | "prose_poem" | "short_story";
  documentUri?: string;
  documentRemoteUrl?: string;
  documentSourceUri?: string;
  documentSourceRemoteUrl?: string;
  songId?: string;
  songUri?: string;
  songRemoteUrl?: string;
  song?: ChipSong;
};

export type NewArtifact = Omit<Artifact, "id" | "capturedAt">;

export async function getArtifacts(): Promise<Artifact[]> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isArtifact).sort((first, second) =>
      second.capturedAt.localeCompare(first.capturedAt),
    );
  } catch {
    return [];
  }
}

export async function addArtifact(input: NewArtifact): Promise<Artifact> {
  const artifact: Artifact = {
    ...input,
    id: `${input.questId}-${Date.now()}`,
    capturedAt: new Date().toISOString(),
  };
  const current = await getArtifacts();
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([artifact, ...current].slice(0, MAX_ARTIFACTS)),
  );
  return artifact;
}

export async function persistArtifactImage(
  sourceUri: string,
  questId: string,
): Promise<string> {
  if (!FileSystem.documentDirectory) return sourceUri;

  const directory = `${FileSystem.documentDirectory}artifacts`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const extension = imageExtension(sourceUri);
  const safeQuestId = questId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const destination = `${directory}/${safeQuestId}-${Date.now()}.${extension}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  return destination;
}

export async function saveDocumentArtifact(input: {
  questId: string;
  questName: string;
  questDescription: string;
  source: string;
  latitude: number;
  longitude: number;
  documentId: string;
  documentKind?: "poem" | "prose_poem" | "short_story";
  documentRemoteUrl: string;
  documentSourceRemoteUrl?: string;
}): Promise<Artifact> {
  const current = await getArtifacts();
  const existing = current.find(
    (artifact) =>
      artifact.kind === "document" &&
      artifact.documentId === input.documentId,
  );
  if (existing) return existing;

  if (!FileSystem.documentDirectory) {
    throw new Error("Persistent document storage is unavailable.");
  }
  const directory = `${FileSystem.documentDirectory}documents`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const safeId = input.documentId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const documentUri = `${directory}/${safeId}.pdf`;
  const sourceUri = `${directory}/${safeId}.tex`;

  const storedPdf = await FileSystem.getInfoAsync(documentUri);
  if (!storedPdf.exists) {
    await FileSystem.downloadAsync(input.documentRemoteUrl, documentUri, {
      headers: { "ngrok-skip-browser-warning": "true" },
    });
  }

  let documentSourceUri: string | undefined;
  if (input.documentSourceRemoteUrl) {
    try {
      const storedSource = await FileSystem.getInfoAsync(sourceUri);
      if (!storedSource.exists) {
        await FileSystem.downloadAsync(
          input.documentSourceRemoteUrl,
          sourceUri,
          { headers: { "ngrok-skip-browser-warning": "true" } },
        );
      }
      documentSourceUri = sourceUri;
    } catch {
      // The PDF remains a complete artifact when source download is unavailable.
    }
  }

  return addArtifact({
    questId: input.questId,
    questName: input.questName,
    questDescription: input.questDescription,
    category: "story",
    kind: "document",
    source: input.source,
    latitude: input.latitude,
    longitude: input.longitude,
    documentId: input.documentId,
    documentKind: input.documentKind,
    documentUri,
    documentRemoteUrl: input.documentRemoteUrl,
    documentSourceUri,
    documentSourceRemoteUrl: input.documentSourceRemoteUrl,
  });
}

export async function saveSongArtifact(input: {
  questId: string;
  questName: string;
  questDescription: string;
  source: string;
  latitude: number;
  longitude: number;
  songId: string;
  song: ChipSong;
  songRemoteUrl?: string;
}): Promise<Artifact> {
  validateChipSong(input.song);
  const current = await getArtifacts();
  const existing = current.find(
    (artifact) => artifact.kind === "song" && artifact.songId === input.songId,
  );
  if (existing) return existing;
  if (!FileSystem.documentDirectory) {
    throw new Error("Persistent song storage is unavailable.");
  }

  const directory = `${FileSystem.documentDirectory}songs`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const safeId = input.songId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const destination = `${directory}/${safeId}.wav`;
  const rendered = await renderChipSong(input.song);
  await FileSystem.copyAsync({ from: rendered, to: destination });

  return addArtifact({
    questId: input.questId,
    questName: input.questName,
    questDescription: input.questDescription,
    category: "music",
    kind: "song",
    source: input.source,
    latitude: input.latitude,
    longitude: input.longitude,
    songId: input.songId,
    songUri: destination,
    songRemoteUrl: input.songRemoteUrl,
    song: input.song,
  });
}

function imageExtension(uri: string) {
  const match = uri.split("?")[0].match(/\.([a-zA-Z0-9]+)$/);
  const extension = match?.[1]?.toLowerCase();
  return extension && ["jpg", "jpeg", "png", "heic"].includes(extension)
    ? extension
    : "jpg";
}

function isArtifact(value: unknown): value is Artifact {
  if (!value || typeof value !== "object") return false;
  const artifact = value as Partial<Artifact>;
  return (
    typeof artifact.id === "string" &&
    typeof artifact.questId === "string" &&
    typeof artifact.questName === "string" &&
    typeof artifact.capturedAt === "string" &&
    typeof artifact.latitude === "number" &&
    typeof artifact.longitude === "number" &&
    (artifact.originalImageUri === undefined ||
      typeof artifact.originalImageUri === "string") &&
    (artifact.treatment === undefined ||
      typeof artifact.treatment === "string") &&
    (artifact.documentId === undefined ||
      typeof artifact.documentId === "string") &&
    (artifact.documentUri === undefined ||
      typeof artifact.documentUri === "string") &&
    (artifact.documentRemoteUrl === undefined ||
      typeof artifact.documentRemoteUrl === "string") &&
    (artifact.songId === undefined || typeof artifact.songId === "string") &&
    (artifact.songUri === undefined || typeof artifact.songUri === "string") &&
    (artifact.kind === "checkin" ||
      artifact.kind === "photo" ||
      artifact.kind === "document" ||
      artifact.kind === "song")
  );
}
