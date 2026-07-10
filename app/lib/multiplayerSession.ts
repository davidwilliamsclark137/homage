import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "homage.multiplayer.profile.v1";

export type MultiplayerProfile = {
  playerId: string;
  playerName: string;
  roomCode: string | null;
  accountId?: string | null;
  accountName?: string | null;
  deviceId?: string | null;
};

export async function getMultiplayerProfile(): Promise<MultiplayerProfile> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<MultiplayerProfile>;
      if (
        typeof parsed.playerId === "string" &&
        typeof parsed.playerName === "string"
      ) {
        return {
          playerId: parsed.playerId,
          playerName: parsed.playerName,
          roomCode:
            typeof parsed.roomCode === "string" ? parsed.roomCode : null,
          accountId:
            typeof parsed.accountId === "string" ? parsed.accountId : null,
          accountName:
            typeof parsed.accountName === "string" ? parsed.accountName : null,
          deviceId: typeof parsed.deviceId === "string" ? parsed.deviceId : null,
        };
      }
    } catch {
      // A new local identity replaces malformed storage.
    }
  }

  const profile = {
    playerId: `player-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    playerName: "Player",
    roomCode: null,
    accountId: null,
    accountName: null,
    deviceId: `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  };
  await saveMultiplayerProfile(profile);
  return profile;
}

export async function saveMultiplayerProfile(profile: MultiplayerProfile) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}
