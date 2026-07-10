import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "homage.signal-hunt.progress.v1";

export type HuntProgress = {
  completedIds: string[];
  awaitingSkyId: string | null;
};

export async function getHuntProgress(): Promise<HuntProgress> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return { completedIds: [], awaitingSkyId: null };

  try {
    const parsed = JSON.parse(stored) as Partial<HuntProgress>;
    return {
      completedIds: Array.isArray(parsed.completedIds)
        ? parsed.completedIds.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
      awaitingSkyId:
        typeof parsed.awaitingSkyId === "string"
          ? parsed.awaitingSkyId
          : null,
    };
  } catch {
    return { completedIds: [], awaitingSkyId: null };
  }
}

export async function saveHuntProgress(progress: HuntProgress) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export async function clearHuntProgress() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
