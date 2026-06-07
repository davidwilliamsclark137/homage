// app/lib/api.ts
import Constants from "expo-constants";

/**
 * API base URL resolution stays identical to what you had:
 * 1) expoConfig.extra.API_BASE (EAS/app.config)
 * 2) manifest.extra.API_BASE (legacy/Expo Go)
 * 3) hard fallback to your Render backend
 */
export const API_BASE: string =
  (Constants?.expoConfig?.extra as any)?.API_BASE ??
  (Constants?.manifest?.extra as any)?.API_BASE ??
  "https://homage-backend.onrender.com";

/** ---- Existing endpoints (unchanged) ---- */
export async function getHealth(): Promise<any> {
  const res = await fetch(`${API_BASE}/healthz`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function uploadForm(form: FormData): Promise<any> {
  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    // IMPORTANT: do NOT set Content-Type manually when sending FormData in RN
    body: form,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}): ${txt}`);
  }
  return res.json();
}

/** ---- Quests: types ---- */
export type Quest = {
  id: string;
  title: string;
  description: string;
  status: "active" | "disabled";
  steps?: Record<string, any> | string; // support either dict or JSON string from backend
  version: number;
  updated_at: string; // ISO8601
};

export type QuestPatch = Partial<
  Pick<Quest, "title" | "description" | "status" | "steps">
> & {
  /** Client's last-known version (required for optimistic concurrency) */
  version: number;
};

export type ProgressIn = {
  player_id: string;
  step_index: number;
  completed: boolean;
  /** Client's last-known quest version for conflict detection */
  quest_version: number;
};

/** ---- Quests: delta sync ---- */
export async function fetchQuestsSince(
  sinceISO?: string | null
): Promise<Quest[]> {
  const url = new URL(`${API_BASE}/quests`);
  if (sinceISO) url.searchParams.set("since", sinceISO);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as Quest[];
  // Normalize updated_at to string
  return data.map((q) => ({
    ...q,
    updated_at: typeof q.updated_at === "string" ? q.updated_at : String(q.updated_at),
  }));
}

/** ---- Quests: patch with optimistic concurrency ----
 * Server should 409 if the version we send is stale.
 */
export async function patchQuest(
  questId: string,
  patch: QuestPatch
): Promise<Quest> {
  const res = await fetch(`${API_BASE}/quests/${encodeURIComponent(questId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (res.status === 409) {
    const text = await res.text().catch(() => "Version conflict");
    const err = new Error(text);
    // @ts-ignore give the caller something easy to branch on
    err.name = "VersionConflict";
    throw err;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()) as Quest;
}

/** ---- Player progress: optimistic submit ----
 * 409 => quest changed; caller should re-sync then retry.
 */
export async function sendProgress(
  questId: string,
  body: ProgressIn
): Promise<{ ok: boolean; updated_at?: string }> {
  const res = await fetch(
    `${API_BASE}/progress/${encodeURIComponent(questId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (res.status === 409) {
    const text = await res.text().catch(() => "Quest changed; refresh required");
    const err = new Error(text);
    // @ts-ignore
    err.name = "VersionConflict";
    throw err;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Optional helper: quick health boolean */
export async function pingHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/healthz`);
    return r.ok;
  } catch {
    return false;
  }
}

