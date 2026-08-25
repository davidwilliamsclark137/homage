import AsyncStorage from "@react-native-async-storage/async-storage";

const PROGRESS_KEY = "homage.hub-progress.v1";

export type SolvedClue = {
  documentId: string;
  hubId: string;
  title: string;
  byline: string;
  body: string;
  solvedAt: string;
};

export type HubProgress = {
  activeHubId?: string;
  solved: Record<string, SolvedClue>;
};

const EMPTY_PROGRESS: HubProgress = { solved: {} };

export async function readHubProgress(): Promise<HubProgress> {
  const raw = await AsyncStorage.getItem(PROGRESS_KEY).catch(() => null);
  if (!raw) return EMPTY_PROGRESS;
  try {
    const parsed = JSON.parse(raw) as HubProgress;
    return { activeHubId: parsed.activeHubId, solved: parsed.solved ?? {} };
  } catch {
    return EMPTY_PROGRESS;
  }
}

export async function setActiveHub(hubId: string) {
  const progress = await readHubProgress();
  await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify({ ...progress, activeHubId: hubId }));
}

export async function saveSolvedClue(clue: SolvedClue) {
  const progress = await readHubProgress();
  const next: HubProgress = {
    activeHubId: clue.hubId,
    solved: { ...progress.solved, [clue.documentId]: clue },
  };
  await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  return next;
}
