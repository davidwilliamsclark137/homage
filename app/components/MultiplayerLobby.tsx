import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  createMultiplayerRoom,
  getMultiplayerRoom,
  joinMultiplayerRoom,
  MultiplayerRoom,
} from "../api";
import { LatLng } from "../lib/geo";
import {
  getMultiplayerProfile,
  MultiplayerProfile,
  saveMultiplayerProfile,
} from "../lib/multiplayerSession";
import { RGB_THEME } from "../lib/theme";

export type ActiveMultiplayerSession = {
  playerId: string;
  room: MultiplayerRoom;
};

type Props = {
  location: LatLng;
  onSession: (session: ActiveMultiplayerSession) => void;
  onClose: () => void;
};

export default function MultiplayerLobby({
  location,
  onSession,
  onClose,
}: Props) {
  const [profile, setProfile] = useState<MultiplayerProfile | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [mode, setMode] = useState<"signal_hunt" | "hide_seek">(
    "signal_hunt",
  );
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getMultiplayerProfile()
      .then(async (stored) => {
        if (!active) return;
        setProfile(stored);
        if (!stored.roomCode) return;

        try {
          const room = await getMultiplayerRoom(
            stored.roomCode,
            stored.playerId,
          );
          if (
            active &&
            room.players.some((player) => player.id === stored.playerId)
          ) {
            onSession({ playerId: stored.playerId, room });
          }
        } catch {
          const cleared = { ...stored, roomCode: null };
          if (active) setProfile(cleared);
          await saveMultiplayerProfile(cleared);
        }
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [onSession]);

  async function createRoom() {
    if (!profile || busy) return;
    setBusy(true);
    setError(null);
    try {
      const room = await createMultiplayerRoom({
        player_id: profile.playerId,
        player_name: cleanName(profile.playerName),
        platform: Platform.OS,
        latitude: location.latitude,
        longitude: location.longitude,
        mode,
      });
      await enterRoom(room);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom() {
    if (!profile || busy) return;
    if (roomCode.trim().length !== 6) {
      setError("Enter the six-character room code.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const room = await joinMultiplayerRoom(roomCode, {
        player_id: profile.playerId,
        player_name: cleanName(profile.playerName),
        platform: Platform.OS,
      });
      await enterRoom(room);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function enterRoom(room: MultiplayerRoom) {
    if (!profile) return;
    const next = {
      ...profile,
      playerName: cleanName(profile.playerName),
      roomCode: room.code,
    };
    setProfile(next);
    await saveMultiplayerProfile(next);
    onSession({ playerId: next.playerId, room });
  }

  if (restoring || !profile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={RGB_THEME.cyan} />
        <Text style={styles.loadingText}>Checking for an active room...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <Text style={styles.kicker}>SHARED PLAY</Text>
        <Text style={styles.title}>Bring someone into your world</Text>
        <Text style={styles.copy}>
          Create an invitation for a nearby player, or enter the code they
          shared with you. You will return to the same world when you leave.
        </Text>

        <View style={styles.modeControl}>
          {[
            { id: "signal_hunt" as const, label: "Explore together" },
            { id: "hide_seek" as const, label: "Hide a signal" },
          ].map((option) => (
            <Pressable
              key={option.id}
              onPress={() => setMode(option.id)}
              style={[
                styles.modeOption,
                mode === option.id && styles.modeOptionActive,
              ]}
            >
              <Text
                style={[
                  styles.modeText,
                  mode === option.id && styles.modeTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Player name</Text>
        <TextInput
          autoCapitalize="words"
          maxLength={30}
          onChangeText={(playerName) =>
            setProfile((current) =>
              current ? { ...current, playerName } : current,
            )
          }
          placeholder="Player"
          placeholderTextColor={RGB_THEME.dim}
          style={styles.input}
          value={profile.playerName}
        />

        <Pressable
          disabled={busy}
          onPress={() => void createRoom()}
          style={[styles.createButton, busy && styles.disabled]}
        >
          <Text style={styles.createText}>Create room</Text>
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR JOIN</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.joinRow}>
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            onChangeText={(value) =>
              setRoomCode(value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())
            }
            placeholder="ABC123"
            placeholderTextColor={RGB_THEME.dim}
            style={[styles.input, styles.codeInput]}
            value={roomCode}
          />
          <Pressable
            disabled={busy}
            onPress={() => void joinRoom()}
            style={[styles.joinButton, busy && styles.disabled]}
          >
            {busy ? (
              <ActivityIndicator color={RGB_THEME.black} />
            ) : (
              <Text style={styles.joinText}>Join</Text>
            )}
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable onPress={onClose} style={styles.soloButton}>
          <Text style={styles.soloText}>Back to the world</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function cleanName(value: string) {
  return value.trim() || "Player";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const styles = StyleSheet.create({
  screen: { backgroundColor: RGB_THEME.background, flex: 1 },
  body: { flex: 1, justifyContent: "center", padding: 26 },
  kicker: { color: RGB_THEME.cyan, fontSize: 11, fontWeight: "900" },
  title: {
    color: RGB_THEME.text,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 7,
  },
  copy: { color: RGB_THEME.muted, fontSize: 15, lineHeight: 22, marginTop: 10 },
  modeControl: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 20,
    overflow: "hidden",
  },
  modeOption: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  modeOptionActive: { backgroundColor: RGB_THEME.cyan },
  modeText: { color: RGB_THEME.muted, fontSize: 13, fontWeight: "800" },
  modeTextActive: { color: RGB_THEME.black },
  label: {
    color: RGB_THEME.muted,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 7,
    marginTop: 18,
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
  createButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.magenta,
    borderRadius: 4,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 52,
  },
  createText: { color: RGB_THEME.black, fontSize: 16, fontWeight: "900" },
  divider: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginVertical: 18,
  },
  dividerLine: { backgroundColor: RGB_THEME.border, flex: 1, height: 1 },
  dividerText: { color: RGB_THEME.dim, fontSize: 10, fontWeight: "900" },
  joinRow: { flexDirection: "row", gap: 10 },
  codeInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0,
    textAlign: "center",
  },
  joinButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.cyan,
    borderRadius: 4,
    justifyContent: "center",
    minHeight: 50,
    width: 92,
  },
  joinText: { color: RGB_THEME.black, fontSize: 15, fontWeight: "900" },
  error: { color: RGB_THEME.danger, fontSize: 13, marginTop: 12 },
  soloButton: { alignItems: "center", minHeight: 48, paddingTop: 18 },
  soloText: { color: RGB_THEME.muted, fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.45 },
  loading: {
    alignItems: "center",
    backgroundColor: RGB_THEME.background,
    flex: 1,
    gap: 12,
    justifyContent: "center",
  },
  loadingText: { color: RGB_THEME.muted, fontSize: 14 },
});
