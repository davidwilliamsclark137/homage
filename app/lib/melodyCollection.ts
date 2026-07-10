import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

import {
  GeneratedMelody,
  generateMelody,
  MelodyMood,
} from "./chiptune";

const STORAGE_KEY = "homage.collected-melodies.v1";
const MAX_MELODIES = 200;

export type CollectedMelody = GeneratedMelody & {
  id: string;
  collectedAt: string;
  latitude: number;
  longitude: number;
  locationName: string;
};

export type MelodyDrop = {
  id: string;
  latitude: number;
  longitude: number;
  locationName: string;
  mood: MelodyMood;
  seed: number;
};

export async function getCollectedMelodies(): Promise<CollectedMelody[]> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCollectedMelody).sort((first, second) =>
      second.collectedAt.localeCompare(first.collectedAt),
    );
  } catch {
    return [];
  }
}

export async function collectMelody(
  drop: MelodyDrop,
): Promise<CollectedMelody> {
  const current = await getCollectedMelodies();
  const existing = current.find((melody) => melody.id === drop.id);
  if (existing) return existing;

  const generated = await generateMelody(drop.mood, drop.seed);
  const uri = await persistMelody(generated.uri, drop.id);
  const melody: CollectedMelody = {
    ...generated,
    id: drop.id,
    uri,
    collectedAt: new Date().toISOString(),
    latitude: drop.latitude,
    longitude: drop.longitude,
    locationName: drop.locationName,
  };

  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([melody, ...current].slice(0, MAX_MELODIES)),
  );
  return melody;
}

export function melodySeed(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function moodForCategory(category: string): MelodyMood {
  if (["park", "trail", "water"].includes(category)) return "dreamy";
  if (["public_art", "historic"].includes(category)) return "arcade";
  return "bright";
}

async function persistMelody(sourceUri: string, id: string) {
  if (!FileSystem.documentDirectory) return sourceUri;

  const directory = `${FileSystem.documentDirectory}melodies`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "-");
  const destination = `${directory}/${safeId}.wav`;

  const existing = await FileSystem.getInfoAsync(destination);
  if (existing.exists) {
    await FileSystem.deleteAsync(destination, { idempotent: true });
  }
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  return destination;
}

function isCollectedMelody(value: unknown): value is CollectedMelody {
  if (!value || typeof value !== "object") return false;
  const melody = value as Partial<CollectedMelody>;
  return (
    typeof melody.id === "string" &&
    typeof melody.uri === "string" &&
    typeof melody.seed === "number" &&
    typeof melody.locationName === "string" &&
    typeof melody.collectedAt === "string" &&
    typeof melody.latitude === "number" &&
    typeof melody.longitude === "number" &&
    typeof melody.tempo === "number" &&
    typeof melody.keyName === "string" &&
    Array.isArray(melody.notes) &&
    (melody.mood === "bright" ||
      melody.mood === "dreamy" ||
      melody.mood === "arcade")
  );
}
