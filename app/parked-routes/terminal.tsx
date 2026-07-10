import React, { useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  API_BASE,
  getCompleted,
  getCustomQuests,
  getDocuments,
  getHealth,
  getLocalAccounts,
  getLocalDatabaseStatus,
  getSongs,
} from "../api";
import { getArtifacts } from "../lib/artifacts";
import { getHuntProgress } from "../lib/huntProgress";
import { getCollectedMelodies } from "../lib/melodyCollection";
import { getMultiplayerProfile } from "../lib/multiplayerSession";
import { RGB_THEME } from "../lib/theme";

type TerminalLine = {
  id: string;
  kind: "input" | "output" | "error" | "system";
  text: string;
};

type TerminalCommand = {
  name: string;
  summary: string;
  run: () => Promise<string> | string;
};

const COMMAND_HELP = [
  ["help", "Show available commands."],
  ["status", "Check backend, local profile, and saved hunt progress."],
  ["database", "Show local-first backend database counts."],
  ["accounts", "List local-first accounts known to the backend."],
  ["pairing", "Show this device's local pairing identity."],
  ["quests", "Show custom quest count for this player."],
  ["artifacts", "Show local artifacts saved on this device."],
  ["melodies", "Show local melodies saved on this device."],
  ["documents", "Show documents published by this player."],
  ["songs", "Show songs published by this player."],
  ["completed", "Show backend completed upload count."],
  ["sky", "Explain current sky/map data sources."],
  ["clear", "Clear this terminal output."],
] as const;

function line(kind: TerminalLine["kind"], text: string): TerminalLine {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    kind,
    text,
  };
}

function formatDate(value?: string | null) {
  if (!value) return "none";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Date(timestamp).toLocaleString();
}

function formatList(values: string[], empty: string) {
  return values.length ? values.join("\n") : empty;
}

export default function TerminalScreen() {
  const scrollRef = useRef<ScrollView | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<TerminalLine[]>([
    line(
      "system",
      "Homage terminal is an allowlisted help console. Type help to see commands.",
    ),
  ]);

  const commands = useMemo<Record<string, TerminalCommand>>(
    () => ({
      help: {
        name: "help",
        summary: "Show available commands.",
        run: () =>
          [
            "Available commands:",
            ...COMMAND_HELP.map(
              ([name, summary]) => `  ${name.padEnd(10)} ${summary}`,
            ),
            "",
            "This console does not run arbitrary shell commands.",
          ].join("\n"),
      },
      status: {
        name: "status",
        summary: "Check backend, local profile, and saved hunt progress.",
        run: async () => {
          const [profile, progress, health] = await Promise.all([
            getMultiplayerProfile(),
            getHuntProgress(),
            getHealth().then(() => "online").catch(() => "offline"),
          ]);
          return [
            `API base: ${API_BASE}`,
            `Backend: ${health}`,
            `Player: ${profile.playerName} (${profile.playerId})`,
            `Device: ${profile.deviceId ?? "unpaired"}`,
            `Account: ${profile.accountName ?? profile.accountId ?? "unpaired"}`,
            `Room: ${profile.roomCode ?? "none"}`,
            `Completed local quests: ${progress.completedIds.length}`,
            `Awaiting sky signal: ${progress.awaitingSkyId ?? "none"}`,
          ].join("\n");
        },
      },
      database: {
        name: "database",
        summary: "Show local-first backend database counts.",
        run: async () => {
          const database = await getLocalDatabaseStatus();
          return [
            `Path: ${database.path}`,
            `Exists: ${database.exists ? "yes" : "no"}`,
            `Size: ${database.size_bytes} bytes`,
            `Schema: ${database.schema_version ?? "unknown"}`,
            "Counts:",
            ...Object.entries(database.counts).map(
              ([key, value]) => `  ${key}: ${value}`,
            ),
          ].join("\n");
        },
      },
      accounts: {
        name: "accounts",
        summary: "List local-first accounts known to the backend.",
        run: async () => {
          const response = await getLocalAccounts();
          return [
            `Accounts: ${response.count}`,
            formatList(
              response.accounts.map(
                (account) =>
                  `  ${account.display_name} (${account.account_id}) updated ${formatDate(
                    account.updated_at,
                  )}`,
              ),
              "  none",
            ),
          ].join("\n");
        },
      },
      pairing: {
        name: "pairing",
        summary: "Show this device's local pairing identity.",
        run: async () => {
          const profile = await getMultiplayerProfile();
          return [
            `Device ID: ${profile.deviceId ?? "none"}`,
            `Account ID: ${profile.accountId ?? "none"}`,
            `Account name: ${profile.accountName ?? "none"}`,
            "Create a new pair code from Admin Dashboard > Create Pair Code.",
            "Claim a code from Pair Device on the phone.",
          ].join("\n");
        },
      },
      quests: {
        name: "quests",
        summary: "Show custom quest count for this player.",
        run: async () => {
          const profile = await getMultiplayerProfile();
          const response = await getCustomQuests(profile.playerId);
          return [
            `Published quests: ${response.count}`,
            formatList(
              response.quests
                .slice(0, 8)
                .map((quest) => `  ${quest.name} / ${quest.category}`),
              "  none",
            ),
          ].join("\n");
        },
      },
      artifacts: {
        name: "artifacts",
        summary: "Show local artifacts saved on this device.",
        run: async () => {
          const artifacts = await getArtifacts();
          return [
            `Local artifacts: ${artifacts.length}`,
            formatList(
              artifacts
                .slice(0, 8)
                .map(
                  (artifact) =>
                    `  ${artifact.questName} / ${artifact.kind} / ${formatDate(
                      artifact.capturedAt,
                    )}`,
                ),
              "  none",
            ),
          ].join("\n");
        },
      },
      melodies: {
        name: "melodies",
        summary: "Show local melodies saved on this device.",
        run: async () => {
          const melodies = await getCollectedMelodies();
          return [
            `Local melodies: ${melodies.length}`,
            formatList(
              melodies
                .slice(0, 8)
                .map(
                  (melody) =>
                    `  ${melody.locationName} / ${melody.mood} / ${melody.keyName}`,
                ),
              "  none",
            ),
          ].join("\n");
        },
      },
      documents: {
        name: "documents",
        summary: "Show documents published by this player.",
        run: async () => {
          const profile = await getMultiplayerProfile();
          const response = await getDocuments(profile.playerId);
          return [
            `Published documents: ${response.count}`,
            formatList(
              response.documents
                .slice(0, 8)
                .map((document) => `  ${document.title} / ${document.document_kind}`),
              "  none",
            ),
          ].join("\n");
        },
      },
      songs: {
        name: "songs",
        summary: "Show songs published by this player.",
        run: async () => {
          const profile = await getMultiplayerProfile();
          const response = await getSongs(profile.playerId);
          return [
            `Published songs: ${response.count}`,
            formatList(
              response.songs
                .slice(0, 8)
                .map((song) => `  ${song.title} / ${song.composition.key}`),
              "  none",
            ),
          ].join("\n");
        },
      },
      completed: {
        name: "completed",
        summary: "Show backend completed upload count.",
        run: async () => {
          const response = await getCompleted();
          return `Backend completed uploads: ${
            response.count ?? response.completed?.length ?? 0
          }`;
        },
      },
      sky: {
        name: "sky",
        summary: "Explain current sky/map data sources.",
        run: () =>
          [
            "Sky: on-device astronomy calculations plus bundled bright-star catalog.",
            "Map quests: generated from nearby public map features when network/backend are available.",
            "Offline behavior: cached nearby quest responses can be reused when present.",
          ].join("\n"),
      },
      clear: {
        name: "clear",
        summary: "Clear this terminal output.",
        run: () => "",
      },
    }),
    [],
  );

  async function submitCommand(rawCommand = input) {
    const normalized = rawCommand.trim().toLowerCase();
    if (!normalized || busy) return;

    setInput("");
    setHistory((current) => [...current, line("input", `$ ${normalized}`)]);

    if (normalized === "clear") {
      setHistory([
        line("system", "Terminal cleared. Type help to see commands."),
      ]);
      return;
    }

    const command = commands[normalized];
    if (!command) {
      setHistory((current) => [
        ...current,
        line(
          "error",
          `Unknown command: ${normalized}\nType help to see approved commands.`,
        ),
      ]);
      return;
    }

    setBusy(true);
    try {
      const output = await command.run();
      if (output) {
        setHistory((current) => [...current, line("output", output)]);
      }
    } catch (error) {
      setHistory((current) => [
        ...current,
        line(
          "error",
          error instanceof Error ? error.message : String(error),
        ),
      ]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollToEnd({ animated: true }),
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>HELP CONSOLE</Text>
            <Text style={styles.title}>Terminal</Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{busy ? "RUNNING" : "READY"}</Text>
          </View>
        </View>

        <View style={styles.quickRow}>
          {["help", "status", "database", "pairing"].map((command) => (
            <Pressable
              key={command}
              disabled={busy}
              onPress={() => void submitCommand(command)}
              style={[styles.quickButton, busy && styles.disabled]}
            >
              <Text style={styles.quickText}>{command}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.outputContent}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
          style={styles.output}
        >
          {history.map((entry) => (
            <Text
              key={entry.id}
              selectable
              style={[
                styles.outputLine,
                entry.kind === "input" && styles.inputLine,
                entry.kind === "error" && styles.errorLine,
                entry.kind === "system" && styles.systemLine,
              ]}
            >
              {entry.text}
            </Text>
          ))}
        </ScrollView>

        <View style={styles.inputRow}>
          <Text style={styles.prompt}>$</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            onChangeText={setInput}
            onSubmitEditing={() => void submitCommand()}
            placeholder="type help"
            placeholderTextColor={RGB_THEME.dim}
            returnKeyType="send"
            selectionColor={RGB_THEME.cyan}
            style={styles.input}
            value={input}
          />
          <Pressable
            disabled={busy || !input.trim()}
            onPress={() => void submitCommand()}
            style={[
              styles.runButton,
              (busy || !input.trim()) && styles.disabled,
            ]}
          >
            <Text style={styles.runText}>Run</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: RGB_THEME.background,
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  kicker: {
    color: RGB_THEME.cyan,
    fontSize: 11,
    fontWeight: "900",
  },
  title: {
    color: RGB_THEME.text,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 2,
  },
  statusPill: {
    borderColor: RGB_THEME.lime,
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    color: RGB_THEME.lime,
    fontSize: 11,
    fontWeight: "900",
  },
  quickRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  quickButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.borderStrong,
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    minHeight: 38,
    justifyContent: "center",
  },
  quickText: {
    color: RGB_THEME.text,
    fontSize: 12,
    fontWeight: "800",
  },
  output: {
    backgroundColor: RGB_THEME.black,
    borderColor: RGB_THEME.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
  },
  outputContent: {
    gap: 10,
    padding: 14,
  },
  outputLine: {
    color: RGB_THEME.text,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    fontSize: 13,
    lineHeight: 19,
  },
  inputLine: {
    color: RGB_THEME.cyan,
    fontWeight: "800",
  },
  errorLine: {
    color: RGB_THEME.danger,
  },
  systemLine: {
    color: RGB_THEME.muted,
  },
  inputRow: {
    alignItems: "center",
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    minHeight: 52,
    paddingHorizontal: 12,
  },
  prompt: {
    color: RGB_THEME.lime,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    fontSize: 16,
    fontWeight: "900",
  },
  input: {
    color: RGB_THEME.text,
    flex: 1,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    fontSize: 15,
    minHeight: 48,
  },
  runButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.cyan,
    borderRadius: 4,
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  runText: {
    color: RGB_THEME.black,
    fontSize: 12,
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.45,
  },
});
