import Constants from "expo-constants";

import type { ChipSong } from "./lib/chipSong";

type AppExtra = { API_BASE?: string; BUILD_LABEL?: string };
type LegacyManifest = { extra?: AppExtra };

const expoExtra = Constants.expoConfig?.extra as AppExtra | undefined;
const legacyExtra = (Constants.manifest as LegacyManifest | null)?.extra;

export const API_BASE: string =
  expoExtra?.API_BASE ??
  legacyExtra?.API_BASE ??
  "https://homage-backend.onrender.com";
export const BUILD_LABEL: string =
  expoExtra?.BUILD_LABEL ?? legacyExtra?.BUILD_LABEL ?? "development";

const NGROK_SKIP_HEADER: Record<string, string> =
  API_BASE.includes("ngrok-free.app") || API_BASE.includes("ngrok.app")
    ? { "ngrok-skip-browser-warning": "true" }
    : {};

function apiHeaders(headers: Record<string, string> = {}) {
  return { ...NGROK_SKIP_HEADER, ...headers };
}

export async function getHealth(): Promise<any> {
  const res = await fetch(`${API_BASE}/healthz`, {
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export type LocalDatabaseStatus = {
  path: string;
  exists: boolean;
  size_bytes: number;
  schema_version: number | null;
  counts: {
    local_accounts: number;
    devices: number;
    players: number;
    quests: number;
    artifacts: number;
    sync_events: number;
  };
};

export type LocalAccount = {
  account_id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};

export type LocalDevice = {
  device_id: string;
  account_id: string | null;
  device_name: string;
  platform: string;
  created_at: string;
  last_seen_at: string;
};

export type PairingCode = {
  code: string;
  account_id: string;
  created_at: string;
  expires_at: string;
};

export async function getLocalDatabaseStatus(): Promise<LocalDatabaseStatus> {
  const res = await fetch(`${API_BASE}/local/database`, {
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error(`Database status failed (${res.status})`);
  return res.json();
}

export async function getLocalAccounts(): Promise<{
  count: number;
  accounts: LocalAccount[];
}> {
  const res = await fetch(`${API_BASE}/local/accounts`, {
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error(`Local accounts failed (${res.status})`);
  return res.json();
}

export async function createLocalAccount(
  displayName: string,
): Promise<{ status: string; account: LocalAccount }> {
  const res = await fetch(`${API_BASE}/local/accounts`, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ display_name: displayName }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      body && typeof body.detail === "string"
        ? body.detail
        : `Local account creation failed (${res.status})`,
    );
  }
  return res.json();
}

export async function createPairingCode(payload: {
  account_id?: string | null;
  display_name: string;
}): Promise<{
  status: string;
  account: LocalAccount;
  pairing: PairingCode;
}> {
  const res = await fetch(`${API_BASE}/local/pairing-codes`, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      body && typeof body.detail === "string"
        ? body.detail
        : `Pairing code failed (${res.status})`,
    );
  }
  return res.json();
}

export async function claimPairingCode(
  code: string,
  payload: {
    device_id: string;
    device_name: string;
    platform: string;
    player_id: string;
    player_name: string;
  },
): Promise<{
  status: string;
  account: LocalAccount;
  device: LocalDevice;
  paired_at: string;
}> {
  const res = await fetch(
    `${API_BASE}/local/pairing-codes/${encodeURIComponent(code)}/claim`,
    {
      method: "POST",
      headers: apiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      body && typeof body.detail === "string"
        ? body.detail
        : `Pairing failed (${res.status})`,
    );
  }
  return res.json();
}

export async function uploadForm(form: FormData): Promise<any> {
  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}): ${txt}`);
  }

  return res.json();
}

export async function getCompleted(): Promise<{
  count: number;
  completed: any[];
}> {
  const res = await fetch(`${API_BASE}/completed`, {
    headers: apiHeaders(),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Completed fetch failed (${res.status}): ${txt}`);
  }

  return res.json();
}

export type GeneratedQuest = {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  radius: number;
  kind: "checkin" | "photo";
  order: number;
  category: string;
  source: string;
  distance_m: number;
  requires_safe_area_confirmation?: boolean;
  stationary_only?: boolean;
  document_id?: string;
  document_url?: string;
  document_source_url?: string;
  document_kind?: "poem" | "prose_poem" | "short_story";
  song_id?: string;
  song_url?: string;
  puzzle_kind?: PuzzleKind;
  puzzle_prompt?: string;
};

export type PuzzleKind = "riddle" | "word_puzzle" | "clue";

export type CommunityQuest = GeneratedQuest & {
  creator_name: string;
  created_at: string;
  creation_accuracy_m: number;
  creation_stationary_fixes: number;
};

export type PublishedDocument = {
  id: string;
  quest_id?: string;
  title: string;
  byline: string;
  document_kind: "poem" | "prose_poem" | "short_story";
  template: "neon" | "terminal" | "letterpress";
  accent: "cyan" | "magenta" | "lime" | "amber";
  typography: "serif" | "sans" | "mono";
  alignment: "left" | "center" | "right";
  created_at: string;
  creator_name: string;
  latitude: number;
  longitude: number;
  pdf_url: string;
  source_url: string;
  puzzle_kind: PuzzleKind;
  puzzle_prompt: string;
};

export type PublishedSong = {
  id: string;
  quest_id: string;
  title: string;
  composition: ChipSong;
  created_at: string;
  creator_name: string;
  latitude: number;
  longitude: number;
  song_url: string;
  puzzle_kind: PuzzleKind;
  puzzle_prompt: string;
};

export type EncryptedPlacedDocument = {
  id: string;
  latitude: number;
  longitude: number;
  altitudeMeters?: number | null;
  altitudeAccuracyMeters?: number | null;
  altitudeToleranceMeters?: number | null;
  radiusMeters: number;
  createdAt: string;
  documentKind: string;
  hint?: string;
  checkpointId?: string;
  checkpointName?: string;
  checkpointLatitude?: number;
  checkpointLongitude?: number;
  checkpointRadiusMeters?: number;
  algorithm: "XChaCha20-Poly1305";
  ciphertextHex: string;
  nonceHex: string;
};

export type NearbyEncryptedPlacedDocument = EncryptedPlacedDocument & {
  distance_m: number;
  checkpoint_distance_m?: number;
};

export type CheckpointEncryptedPlacedDocument = EncryptedPlacedDocument & {
  checkpoint_distance_m: number;
  artifact_distance_m: number;
};

export type QuestGenerationResponse = {
  status: string;
  source: string;
  cached?: boolean;
  center: { latitude: number; longitude: number };
  radius_m: number;
  features_considered: number;
  quests: GeneratedQuest[];
  warning?: string;
  safety?: {
    policy_version: number;
    road_buffered: boolean;
    procedural_destinations: boolean;
    stationary_confirmation_required?: boolean;
  };
};

export type MultiplayerRole =
  | "pathfinder"
  | "archivist"
  | "hider"
  | "seeker";

export type MultiplayerPlayer = {
  id: string;
  name: string;
  platform: string;
  role: MultiplayerRole;
  joined_at: string;
};

export type MultiplayerRoom = {
  code: string;
  mode: "signal_hunt" | "hide_seek";
  safety_policy_version: number;
  status: "waiting" | "active" | "complete";
  created_at: string;
  updated_at: string;
  quest_index: number;
  quests: GeneratedQuest[];
  completed_ids: string[];
  players: MultiplayerPlayer[];
  progress: {
    quest_id: string | null;
    melody_by: string | null;
    photo_by: string | null;
    sky_by: string[];
  };
  hide_seek?: {
    selected_quest: GeneratedQuest | null;
    ready: boolean;
    photo_url: string | null;
    treatment: string | null;
    distance_m: number | null;
    temperature:
      | "cold"
      | "cool"
      | "warm"
      | "hot"
      | "burning"
      | "signal"
      | null;
    trend: "warmer" | "colder" | "steady" | null;
    can_find: boolean;
    found: boolean;
    found_by: string | null;
    sky_by: string[];
    requires_safe_area_confirmation: boolean;
  };
};

export async function generateEnvironmentQuests(payload: {
  latitude: number;
  longitude: number;
  radius_m?: number;
  limit?: number;
}): Promise<QuestGenerationResponse> {
  const res = await fetch(`${API_BASE}/quests/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Quest generation failed (${res.status}): ${txt}`);
  }

  return res.json();
}

export async function createCustomQuest(payload: {
  player_id: string;
  player_name: string;
  name: string;
  description: string;
  category: "observation" | "photography" | "sound" | "sky";
  latitude: number;
  longitude: number;
  accuracy: number;
  stationary_fixes: number;
  safe_area_confirmed: boolean;
}): Promise<{ status: string; quest: CommunityQuest }> {
  const response = await fetch(`${API_BASE}/quests/custom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body && typeof body.detail === "string"
        ? body.detail
        : `Quest creation failed (${response.status})`,
    );
  }
  return response.json();
}

export async function getCustomQuests(
  playerId: string,
): Promise<{ count: number; quests: CommunityQuest[] }> {
  const response = await fetch(
    `${API_BASE}/quests/custom?player_id=${encodeURIComponent(playerId)}`,
    { headers: apiHeaders() },
  );
  if (!response.ok) {
    throw new Error(`Quest dashboard failed (${response.status})`);
  }
  return response.json();
}

export async function createDocument(payload: {
  player_id: string;
  player_name: string;
  title: string;
  body: string;
  byline: string;
  document_kind: "poem" | "prose_poem" | "short_story";
  template: "neon" | "terminal" | "letterpress";
  accent: "cyan" | "magenta" | "lime" | "amber";
  typography: "serif" | "sans" | "mono";
  alignment: "left" | "center" | "right";
  puzzle_kind: PuzzleKind;
  puzzle_prompt: string;
  puzzle_answer: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  stationary_fixes: number;
  safe_area_confirmed: boolean;
}): Promise<{
  status: string;
  document: PublishedDocument;
  quest: CommunityQuest;
}> {
  const response = await fetch(`${API_BASE}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body && typeof body.detail === "string"
        ? body.detail
        : `Document publishing failed (${response.status})`,
    );
  }
  return response.json();
}

export async function getDocuments(
  playerId: string,
): Promise<{ count: number; documents: PublishedDocument[] }> {
  const response = await fetch(
    `${API_BASE}/documents?player_id=${encodeURIComponent(playerId)}`,
    { headers: apiHeaders() },
  );
  if (!response.ok) {
    throw new Error(`Document dashboard failed (${response.status})`);
  }
  return response.json();
}

export async function createEncryptedPlacement(payload: {
  creator_player_id?: string | null;
  document: EncryptedPlacedDocument;
}): Promise<{ status: string; document: EncryptedPlacedDocument }> {
  const response = await fetch(`${API_BASE}/encrypted-placements`, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body && typeof body.detail === "string"
        ? body.detail
        : `Encrypted placement upload failed (${response.status})`,
    );
  }
  return response.json();
}

export async function getNearbyEncryptedPlacements(payload: {
  latitude: number;
  longitude: number;
  radius_m?: number;
  limit?: number;
}): Promise<{ count: number; documents: NearbyEncryptedPlacedDocument[] }> {
  const params = new URLSearchParams({
    latitude: String(payload.latitude),
    longitude: String(payload.longitude),
    radius_m: String(payload.radius_m ?? 1_000),
    limit: String(payload.limit ?? 20),
  });
  const response = await fetch(
    `${API_BASE}/encrypted-placements/nearby?${params.toString()}`,
    { headers: apiHeaders() },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body && typeof body.detail === "string"
        ? body.detail
        : `Encrypted placement discovery failed (${response.status})`,
    );
  }
  return response.json();
}

export async function getCheckpointEncryptedPlacements(payload: {
  checkpoint_id: string;
  latitude: number;
  longitude: number;
  limit?: number;
}): Promise<{ count: number; documents: CheckpointEncryptedPlacedDocument[] }> {
  const params = new URLSearchParams({
    latitude: String(payload.latitude),
    longitude: String(payload.longitude),
    limit: String(payload.limit ?? 20),
  });
  const response = await fetch(
    `${API_BASE}/checkpoints/${encodeURIComponent(payload.checkpoint_id)}/encrypted-placements?${params.toString()}`,
    { headers: apiHeaders() },
  );
  if (response.status === 404) {
    const fallback = await getNearbyEncryptedPlacements({
      latitude: payload.latitude,
      longitude: payload.longitude,
      radius_m: 10_000,
      limit: 50,
    });
    const documents = fallback.documents
      .filter((document) => document.checkpointId === payload.checkpoint_id)
      .slice(0, payload.limit ?? 20)
      .map((document) => ({
        ...document,
        checkpoint_distance_m: document.checkpoint_distance_m ?? document.distance_m,
        artifact_distance_m: document.distance_m,
      }));
    return { count: documents.length, documents };
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body && typeof body.detail === "string"
        ? body.detail
        : `Checkpoint artifact discovery failed (${response.status})`,
    );
  }
  return response.json();
}

export async function createSong(payload: {
  player_id: string;
  player_name: string;
  title: string;
  composition: ChipSong;
  puzzle_kind: PuzzleKind;
  puzzle_prompt: string;
  puzzle_answer: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  stationary_fixes: number;
  safe_area_confirmed: boolean;
}): Promise<{
  status: string;
  song: PublishedSong;
  quest: CommunityQuest;
}> {
  const response = await fetch(`${API_BASE}/songs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body && typeof body.detail === "string"
        ? body.detail
        : `Song publishing failed (${response.status})`,
    );
  }
  return response.json();
}

export async function getSongs(
  playerId: string,
): Promise<{ count: number; songs: PublishedSong[] }> {
  const response = await fetch(
    `${API_BASE}/songs?player_id=${encodeURIComponent(playerId)}`,
    { headers: apiHeaders() },
  );
  if (!response.ok) {
    throw new Error(`Song library failed (${response.status})`);
  }
  return response.json();
}

export async function getSong(songId: string): Promise<PublishedSong> {
  const response = await fetch(
    `${API_BASE}/songs/${encodeURIComponent(songId)}`,
  );
  if (!response.ok) {
    throw new Error(`Song recovery failed (${response.status})`);
  }
  return response.json();
}

export async function unlockArtifact(payload: {
  artifact_kind: "document" | "song";
  artifact_id: string;
  answer: string;
}): Promise<
  | {
      status: string;
      artifact_kind: "document";
      document: PublishedDocument;
    }
  | { status: string; artifact_kind: "song"; song: PublishedSong }
> {
  const response = await fetch(`${API_BASE}/artifacts/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body && typeof body.detail === "string"
        ? body.detail
        : `Artifact unlock failed (${response.status})`,
    );
  }
  return response.json();
}

export async function createMultiplayerRoom(payload: {
  player_id: string;
  player_name: string;
  platform: string;
  latitude: number;
  longitude: number;
  mode: "signal_hunt" | "hide_seek";
}): Promise<MultiplayerRoom> {
  return multiplayerRequest("/multiplayer/rooms", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function joinMultiplayerRoom(
  code: string,
  payload: {
    player_id: string;
    player_name: string;
    platform: string;
  },
): Promise<MultiplayerRoom> {
  return multiplayerRequest(
    `/multiplayer/rooms/${encodeURIComponent(code.trim().toUpperCase())}/join`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function getMultiplayerRoom(
  code: string,
  playerId?: string,
): Promise<MultiplayerRoom> {
  const query = playerId
    ? `?player_id=${encodeURIComponent(playerId)}`
    : "";
  return multiplayerRequest(
    `/multiplayer/rooms/${encodeURIComponent(code.trim().toUpperCase())}${query}`,
  );
}

export async function submitMultiplayerAction(
  code: string,
  payload: {
    player_id: string;
    quest_id: string;
    action: "melody" | "photo" | "sky";
    safe_area_confirmed?: boolean;
  },
): Promise<MultiplayerRoom> {
  return multiplayerRequest(
    `/multiplayer/rooms/${encodeURIComponent(code.trim().toUpperCase())}/actions`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function selectHidingPlace(
  code: string,
  playerId: string,
  questId: string,
) {
  return multiplayerRequest(
    `/multiplayer/rooms/${encodeURIComponent(code)}/hide/select`,
    {
      method: "POST",
      body: JSON.stringify({ player_id: playerId, quest_id: questId }),
    },
  );
}

export async function markHiddenSignalReady(
  code: string,
  payload: {
    player_id: string;
    photo_url?: string;
    treatment?: string;
    safe_area_confirmed?: boolean;
  },
) {
  return multiplayerRequest(
    `/multiplayer/rooms/${encodeURIComponent(code)}/hide/ready`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function updateSeekerPosition(
  code: string,
  payload: {
    player_id: string;
    latitude: number;
    longitude: number;
    accuracy: number;
  },
) {
  return multiplayerRequest(
    `/multiplayer/rooms/${encodeURIComponent(code)}/hide/position`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function findHiddenSignal(
  code: string,
  playerId: string,
  safeAreaConfirmed = false,
) {
  return multiplayerRequest(
    `/multiplayer/rooms/${encodeURIComponent(code)}/hide/found`,
    {
      method: "POST",
      body: JSON.stringify({
        player_id: playerId,
        safe_area_confirmed: safeAreaConfirmed,
      }),
    },
  );
}

export async function lockHideSeekSky(code: string, playerId: string) {
  return multiplayerRequest(
    `/multiplayer/rooms/${encodeURIComponent(code)}/hide/sky`,
    {
      method: "POST",
      body: JSON.stringify({ player_id: playerId }),
    },
  );
}

async function multiplayerRequest(
  path: string,
  init: RequestInit = {},
): Promise<MultiplayerRoom> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail =
      body && typeof body.detail === "string" ? body.detail : `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return response.json();
}

export async function generateMaze(payload: any): Promise<{
  status: string;
  source: string;
  path: { latitude: number; longitude: number }[];
}> {
  const res = await fetch(`${API_BASE}/maze/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Maze generate failed (${res.status}): ${txt}`);
  }

  return res.json();
}
