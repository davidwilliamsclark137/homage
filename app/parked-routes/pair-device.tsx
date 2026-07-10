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
import * as Device from "expo-device";
import { SafeAreaView } from "react-native-safe-area-context";

import { claimPairingCode } from "../api";
import {
  getMultiplayerProfile,
  MultiplayerProfile,
  saveMultiplayerProfile,
} from "../lib/multiplayerSession";
import { RGB_THEME } from "../lib/theme";

export default function PairDeviceScreen() {
  const [profile, setProfile] = useState<MultiplayerProfile | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [pairing, setPairing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMultiplayerProfile()
      .then((next) => setProfile(ensureDeviceId(next)))
      .catch((caught) => setError(errorMessage(caught)))
      .finally(() => setLoading(false));
  }, []);

  async function pair() {
    if (!profile || pairing) return;
    const normalizedCode = code.replace(/[^a-z0-9]/gi, "").toUpperCase();
    if (normalizedCode.length !== 6) {
      setError("Enter the 6-character desktop pairing code.");
      return;
    }
    const nextProfile = ensureDeviceId(profile);
    setPairing(true);
    setError(null);
    setMessage(null);
    try {
      const result = await claimPairingCode(normalizedCode, {
        device_id: nextProfile.deviceId!,
        device_name: deviceName(),
        platform: Platform.OS,
        player_id: nextProfile.playerId,
        player_name: nextProfile.playerName,
      });
      const pairedProfile = {
        ...nextProfile,
        accountId: result.account.account_id,
        accountName: result.account.display_name,
        deviceId: result.device.device_id,
      };
      await saveMultiplayerProfile(pairedProfile);
      setProfile(pairedProfile);
      setMessage(`Paired with ${result.account.display_name}.`);
      setCode("");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPairing(false);
    }
  }

  if (loading || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={RGB_THEME.cyan} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={["bottom"]} style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.kicker}>LOCAL HOME BASE</Text>
        <Text style={styles.title}>Pair this device</Text>
        <Text style={styles.copy}>
          Create a pairing code on the desktop admin dashboard, then enter it
          here to link this phone to the local database.
        </Text>

        <View style={styles.statusPanel}>
          <Text style={styles.statusLabel}>Current device</Text>
          <Text style={styles.statusValue}>{deviceName()}</Text>
          <Text style={styles.statusSubvalue}>{profile.deviceId}</Text>
        </View>

        {profile.accountId ? (
          <View style={[styles.statusPanel, styles.pairedPanel]}>
            <Text style={styles.statusLabel}>Paired account</Text>
            <Text style={styles.pairedValue}>{profile.accountName}</Text>
            <Text style={styles.statusSubvalue}>{profile.accountId}</Text>
          </View>
        ) : null}

        <TextInput
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          onChangeText={(value) =>
            setCode(value.replace(/[^a-z0-9]/gi, "").toUpperCase())
          }
          placeholder="PAIR CODE"
          placeholderTextColor={RGB_THEME.dim}
          style={styles.input}
          value={code}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        <Pressable
          disabled={pairing}
          onPress={() => void pair()}
          style={[styles.button, pairing && styles.disabled]}
        >
          {pairing ? (
            <ActivityIndicator color={RGB_THEME.black} />
          ) : (
            <Text style={styles.buttonText}>Pair with desktop</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ensureDeviceId(profile: MultiplayerProfile): MultiplayerProfile {
  if (profile.deviceId) return profile;
  return {
    ...profile,
    deviceId: `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  };
}

function deviceName() {
  return Device.deviceName || `${Platform.OS} device`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const styles = StyleSheet.create({
  screen: { backgroundColor: RGB_THEME.background, flex: 1 },
  center: {
    alignItems: "center",
    backgroundColor: RGB_THEME.background,
    flex: 1,
    justifyContent: "center",
  },
  content: {
    alignSelf: "center",
    maxWidth: 680,
    padding: 22,
    width: "100%",
  },
  kicker: {
    color: RGB_THEME.cyan,
    fontSize: 11,
    fontWeight: "900",
  },
  title: {
    color: RGB_THEME.text,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 4,
  },
  copy: {
    color: RGB_THEME.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  statusPanel: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 18,
    padding: 14,
  },
  pairedPanel: {
    borderColor: RGB_THEME.lime,
  },
  statusLabel: {
    color: RGB_THEME.dim,
    fontSize: 10,
    fontWeight: "900",
  },
  statusValue: {
    color: RGB_THEME.text,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
  },
  pairedValue: {
    color: RGB_THEME.lime,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 4,
  },
  statusSubvalue: {
    color: RGB_THEME.muted,
    fontSize: 12,
    marginTop: 4,
  },
  input: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.cyan,
    borderRadius: 6,
    borderWidth: 1,
    color: RGB_THEME.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 4,
    marginTop: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlign: "center",
  },
  button: {
    alignItems: "center",
    backgroundColor: RGB_THEME.cyan,
    borderRadius: 6,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 52,
  },
  buttonText: {
    color: RGB_THEME.black,
    fontSize: 15,
    fontWeight: "900",
  },
  disabled: { opacity: 0.55 },
  error: {
    color: RGB_THEME.danger,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 14,
  },
  success: {
    color: RGB_THEME.lime,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 14,
  },
});
