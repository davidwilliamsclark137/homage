import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Href, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  API_BASE,
  createPairingCode,
  getCompleted,
  getDocuments,
  getHealth,
  getLocalAccounts,
  getLocalDatabaseStatus,
  LocalAccount,
  LocalDatabaseStatus,
  PairingCode,
  PublishedDocument,
} from "../api";
import {
  getMultiplayerProfile,
  MultiplayerProfile,
} from "../lib/multiplayerSession";
import { RGB_THEME } from "../lib/theme";

type AdminState = {
  backend: "checking" | "online" | "offline";
  completedCount: number;
  database: LocalDatabaseStatus | null;
  accounts: LocalAccount[];
  documents: PublishedDocument[];
};

const INITIAL_STATE: AdminState = {
  backend: "checking",
  completedCount: 0,
  database: null,
  accounts: [],
  documents: [],
};

const STUDIO_LINKS = [
  {
    href: "/document-studio",
    label: "Document Studio",
    accent: RGB_THEME.lime,
  },
  {
    href: "/terminal",
    label: "Terminal Help",
    accent: RGB_THEME.cyan,
  },
  {
    href: "/artifacts",
    label: "Artifacts",
    accent: RGB_THEME.amber,
  },
] as const;

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<MultiplayerProfile | null>(null);
  const [state, setState] = useState<AdminState>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("Homage Home Base");
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairing, setPairing] = useState<PairingCode | null>(null);
  const [pairingAccount, setPairingAccount] = useState<LocalAccount | null>(null);
  const [pairingMessage, setPairingMessage] = useState<string | null>(null);

  async function load() {
    setError(null);
    const nextProfile = await getMultiplayerProfile();
    setProfile(nextProfile);

    const healthPromise = getHealth()
      .then(() => "online" as const)
      .catch(() => "offline" as const);
    const completedPromise = getCompleted()
      .then((response) => response.count ?? response.completed?.length ?? 0)
      .catch(() => 0);
    const databasePromise = getLocalDatabaseStatus().catch(() => null);
    const accountsPromise = getLocalAccounts()
      .then((response) => response.accounts)
      .catch(() => []);
    const documentsPromise = getDocuments(nextProfile.playerId)
      .then((response) => response.documents)
      .catch(() => []);

    const [backend, completedCount, database, accounts, documents] =
      await Promise.all([
        healthPromise,
        completedPromise,
        databasePromise,
        accountsPromise,
        documentsPromise,
      ]);

    if (accounts[0]) {
      setAccountName(accounts[0].display_name);
    }

    setState({
      backend,
      completedCount,
      database,
      accounts,
      documents,
    });
  }

  useEffect(() => {
    let active = true;
    load()
      .catch((caught) => {
        if (active) setError(errorMessage(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setRefreshing(false);
    }
  }

  async function generatePairingCode() {
    if (pairingBusy) return;
    setPairingBusy(true);
    setError(null);
    setPairingMessage(null);
    try {
      const account = state.accounts[0];
      const result = await createPairingCode({
        account_id: account?.account_id ?? null,
        display_name: accountName.trim() || "Homage Home Base",
      });
      setPairing(result.pairing);
      setPairingAccount(result.account);
      setPairingMessage("Enter this code on the phone Pair Device screen.");
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPairingBusy(false);
    }
  }

  const latest = state.documents
    .map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.document_kind.replaceAll("_", " "),
      createdAt: item.created_at,
      accent: RGB_THEME.lime,
    }))
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .slice(0, 6);

  return (
    <SafeAreaView edges={["bottom"]} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.shell}>
          <View style={styles.headerBand}>
            <View>
              <Text style={styles.kicker}>HOMAGE ADMIN</Text>
              <Text style={styles.title}>World Dashboard</Text>
            </View>
            <Pressable
              disabled={refreshing}
              onPress={() => void refresh()}
              style={[styles.refreshButton, refreshing && styles.disabled]}
            >
              {refreshing ? (
                <ActivityIndicator color={RGB_THEME.black} />
              ) : (
                <Text style={styles.refreshText}>Refresh</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.statusBand}>
            <StatusPill
              label={state.backend === "online" ? "Backend online" : "Backend offline"}
              tone={state.backend === "online" ? RGB_THEME.lime : RGB_THEME.danger}
            />
            <Text numberOfLines={1} style={styles.apiText}>
              {API_BASE}
            </Text>
            <Text style={styles.deviceText}>
              {Platform.OS === "web" ? "Desktop web" : "Mobile preview"}
              {profile ? ` / ${profile.playerName}` : ""}
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingPanel}>
              <ActivityIndicator color={RGB_THEME.cyan} />
            </View>
          ) : (
            <>
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.statsGrid}>
                <Stat label="PDFs" value={state.documents.length} accent={RGB_THEME.lime} />
                <Stat label="Completed" value={state.completedCount} accent={RGB_THEME.amber} />
              </View>

              <View style={styles.databasePanel}>
                <View>
                  <Text style={styles.databaseLabel}>LOCAL DATABASE</Text>
                  <Text numberOfLines={1} style={styles.databasePath}>
                    {state.database?.path ?? "Unavailable"}
                  </Text>
                </View>
                <View style={styles.databaseMetrics}>
                  <Text style={styles.databaseMetric}>
                    Schema {state.database?.schema_version ?? "-"}
                  </Text>
                  <Text style={styles.databaseMetric}>
                    {state.database
                      ? totalDatabaseRecords(state.database).toLocaleString()
                      : "0"}{" "}
                    records
                  </Text>
                </View>
              </View>

              <View style={styles.pairingPanel}>
                <View style={styles.pairingHeader}>
                  <View>
                    <Text style={styles.pairingLabel}>DEVICE PAIRING</Text>
                    <Text style={styles.pairingTitle}>Local account link</Text>
                  </View>
                  <Text style={styles.pairingCount}>
                    {state.accounts.length}{" "}
                    {state.accounts.length === 1 ? "account" : "accounts"}
                  </Text>
                </View>
                <View style={styles.pairingBody}>
                  <TextInput
                    onChangeText={setAccountName}
                    placeholder="Home base name"
                    placeholderTextColor={RGB_THEME.dim}
                    style={styles.accountInput}
                    value={accountName}
                  />
                  <Pressable
                    disabled={pairingBusy}
                    onPress={() => void generatePairingCode()}
                    style={[styles.pairingButton, pairingBusy && styles.disabled]}
                  >
                    {pairingBusy ? (
                      <ActivityIndicator color={RGB_THEME.black} />
                    ) : (
                      <Text style={styles.pairingButtonText}>Create Pair Code</Text>
                    )}
                  </Pressable>
                </View>
                {pairing ? (
                  <View style={styles.codePanel}>
                    <Text selectable style={styles.pairingCode}>
                      {pairing.code}
                    </Text>
                    <Text style={styles.codeMeta}>
                      {pairingAccount?.display_name ?? accountName} / expires{" "}
                      {formatTime(pairing.expires_at)}
                    </Text>
                  </View>
                ) : null}
                {pairingMessage ? (
                  <Text style={styles.pairingHint}>{pairingMessage}</Text>
                ) : null}
              </View>

              <View style={styles.studioGrid}>
                {STUDIO_LINKS.map((item) => (
                  <Pressable
                    key={item.href}
                    onPress={() => router.push(item.href as Href)}
                    style={[styles.studioButton, { borderColor: item.accent }]}
                  >
                    <View
                      style={[
                        styles.studioLight,
                        { backgroundColor: item.accent },
                      ]}
                    />
                    <Text style={[styles.studioText, { color: item.accent }]}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Latest Drops</Text>
                  <Text style={styles.sectionCount}>{latest.length}</Text>
                </View>
                {latest.length ? (
                  latest.map((item) => (
                    <View key={item.id} style={styles.dropRow}>
                      <View
                        style={[styles.dropMarker, { backgroundColor: item.accent }]}
                      />
                      <View style={styles.dropText}>
                        <Text numberOfLines={1} style={styles.dropTitle}>
                          {item.title}
                        </Text>
                        <Text style={styles.dropDetail}>{item.detail}</Text>
                      </View>
                      <Text style={styles.dropDate}>{formatDate(item.createdAt)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.empty}>No documents published yet.</Text>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <View style={[styles.statPanel, { borderTopColor: accent }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StatusPill({ label, tone }: { label: string; tone: string }) {
  return (
    <View style={[styles.statusPill, { borderColor: tone }]}>
      <View style={[styles.statusDot, { backgroundColor: tone }]} />
      <Text style={[styles.statusText, { color: tone }]}>{label}</Text>
    </View>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function totalDatabaseRecords(database: LocalDatabaseStatus) {
  return Object.values(database.counts).reduce((total, count) => total + count, 0);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const styles = StyleSheet.create({
  screen: { backgroundColor: RGB_THEME.background, flex: 1 },
  content: {
    alignItems: "center",
    padding: 18,
    paddingBottom: 48,
  },
  shell: {
    maxWidth: 1180,
    width: "100%",
  },
  headerBand: {
    alignItems: "center",
    borderBottomColor: RGB_THEME.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
    paddingBottom: 18,
    paddingTop: 8,
  },
  kicker: {
    color: RGB_THEME.cyan,
    fontSize: 11,
    fontWeight: "900",
  },
  title: {
    color: RGB_THEME.text,
    fontSize: 34,
    fontWeight: "900",
    marginTop: 4,
  },
  refreshButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.cyan,
    borderRadius: 6,
    minHeight: 42,
    minWidth: 108,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  refreshText: {
    color: RGB_THEME.black,
    fontSize: 13,
    fontWeight: "900",
  },
  disabled: { opacity: 0.55 },
  statusBand: {
    alignItems: "center",
    borderBottomColor: RGB_THEME.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingVertical: 16,
  },
  statusPill: {
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statusDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "900",
  },
  apiText: {
    color: RGB_THEME.muted,
    flexGrow: 1,
    flexShrink: 1,
    fontSize: 12,
    minWidth: 220,
  },
  deviceText: {
    color: RGB_THEME.dim,
    fontSize: 12,
    fontWeight: "800",
  },
  loadingPanel: {
    alignItems: "center",
    minHeight: 260,
    justifyContent: "center",
  },
  error: {
    color: RGB_THEME.danger,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 18,
  },
  statPanel: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 6,
    borderTopWidth: 3,
    borderWidth: 1,
    flexBasis: 180,
    flexGrow: 1,
    padding: 16,
  },
  statValue: {
    color: RGB_THEME.text,
    fontSize: 32,
    fontWeight: "900",
  },
  statLabel: {
    color: RGB_THEME.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
  databasePanel: {
    alignItems: "center",
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
    marginTop: 18,
    padding: 16,
  },
  databaseLabel: {
    color: RGB_THEME.lime,
    fontSize: 10,
    fontWeight: "900",
  },
  databasePath: {
    color: RGB_THEME.text,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 5,
    maxWidth: 760,
  },
  databaseMetrics: {
    alignItems: "flex-end",
    gap: 4,
  },
  databaseMetric: {
    color: RGB_THEME.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  pairingPanel: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 18,
    padding: 16,
  },
  pairingHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pairingLabel: {
    color: RGB_THEME.cyan,
    fontSize: 10,
    fontWeight: "900",
  },
  pairingTitle: {
    color: RGB_THEME.text,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 3,
  },
  pairingCount: {
    color: RGB_THEME.dim,
    fontSize: 12,
    fontWeight: "800",
  },
  pairingBody: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 14,
  },
  accountInput: {
    backgroundColor: RGB_THEME.background,
    borderColor: RGB_THEME.border,
    borderRadius: 6,
    borderWidth: 1,
    color: RGB_THEME.text,
    flexBasis: 240,
    flexGrow: 1,
    fontSize: 14,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  pairingButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.lime,
    borderRadius: 6,
    flexBasis: 180,
    flexGrow: 0,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 16,
  },
  pairingButtonText: {
    color: RGB_THEME.black,
    fontSize: 13,
    fontWeight: "900",
  },
  codePanel: {
    alignItems: "center",
    backgroundColor: RGB_THEME.background,
    borderColor: RGB_THEME.lime,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  pairingCode: {
    color: RGB_THEME.lime,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 8,
  },
  codeMeta: {
    color: RGB_THEME.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8,
  },
  pairingHint: {
    color: RGB_THEME.cyan,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 10,
  },
  studioGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 18,
  },
  studioButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.surface,
    borderRadius: 6,
    borderWidth: 1,
    flexBasis: 220,
    flexDirection: "row",
    flexGrow: 1,
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 16,
  },
  studioLight: {
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  studioText: {
    fontSize: 14,
    fontWeight: "900",
  },
  section: {
    marginTop: 28,
  },
  sectionHeader: {
    alignItems: "center",
    borderBottomColor: RGB_THEME.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 10,
  },
  sectionTitle: {
    color: RGB_THEME.text,
    fontSize: 18,
    fontWeight: "900",
  },
  sectionCount: {
    color: RGB_THEME.cyan,
    fontSize: 12,
    fontWeight: "900",
  },
  dropRow: {
    alignItems: "center",
    borderBottomColor: RGB_THEME.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 62,
    paddingVertical: 12,
  },
  dropMarker: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  dropText: {
    flex: 1,
    minWidth: 0,
  },
  dropTitle: {
    color: RGB_THEME.text,
    fontSize: 14,
    fontWeight: "800",
  },
  dropDetail: {
    color: RGB_THEME.muted,
    fontSize: 12,
    marginTop: 3,
  },
  dropDate: {
    color: RGB_THEME.dim,
    fontSize: 12,
    fontWeight: "800",
  },
  empty: {
    color: RGB_THEME.muted,
    fontSize: 13,
    paddingVertical: 18,
  },
});
