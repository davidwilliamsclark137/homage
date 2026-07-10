import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RGB_THEME } from "../lib/theme";

type DemoId =
  | "notebook"
  | "instrument"
  | "cabinet"
  | "place"
  | "ritual"
  | "receiver";

type Demo = {
  id: DemoId;
  title: string;
  signal: string;
  accent: string;
};

const DEMOS: Demo[] = [
  {
    id: "notebook",
    title: "Field Notebook",
    signal: "Write from the current place",
    accent: RGB_THEME.lime,
  },
  {
    id: "instrument",
    title: "Signal Instrument",
    signal: "Treat the app like a field device",
    accent: RGB_THEME.cyan,
  },
  {
    id: "cabinet",
    title: "Artifact Cabinet",
    signal: "Browse saved documents as objects",
    accent: RGB_THEME.amber,
  },
  {
    id: "place",
    title: "Mapless Place",
    signal: "Use nearby landmarks without a map",
    accent: RGB_THEME.magenta,
  },
  {
    id: "ritual",
    title: "Writing Ritual",
    signal: "Move through a deliberate publish rite",
    accent: RGB_THEME.lime,
  },
  {
    id: "receiver",
    title: "Signal Receiver",
    signal: "Tune into local documents",
    accent: RGB_THEME.cyan,
  },
];

export default function UILabScreen() {
  const [selected, setSelected] = useState<DemoId>("notebook");
  const active = DEMOS.find((demo) => demo.id === selected) ?? DEMOS[0];

  return (
    <SafeAreaView edges={["bottom"]} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.kicker}>HOMAGE UI LAB</Text>
          <Text style={styles.title}>Interface studies</Text>
          <Text style={styles.copy}>
            Non-conventional directions for a phone-first document and place
            instrument.
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.tabs}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {DEMOS.map((demo) => {
            const isActive = demo.id === selected;
            return (
              <Pressable
                key={demo.id}
                onPress={() => setSelected(demo.id)}
                style={[
                  styles.tab,
                  isActive && {
                    borderColor: demo.accent,
                    backgroundColor: RGB_THEME.surfaceRaised,
                  },
                ]}
              >
                <View
                  style={[
                    styles.tabLight,
                    { backgroundColor: isActive ? demo.accent : RGB_THEME.dim },
                  ]}
                />
                <Text
                  style={[
                    styles.tabText,
                    isActive && { color: demo.accent },
                  ]}
                >
                  {demo.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[styles.demoFrame, { borderColor: active.accent }]}>
          <View style={styles.demoHeader}>
            <View>
              <Text style={[styles.demoKicker, { color: active.accent }]}>
                {active.title.toUpperCase()}
              </Text>
              <Text style={styles.demoSignal}>{active.signal}</Text>
            </View>
            <View style={[styles.beacon, { borderColor: active.accent }]}>
              <View style={[styles.beaconCore, { backgroundColor: active.accent }]} />
            </View>
          </View>
          {selected === "notebook" ? <NotebookDemo /> : null}
          {selected === "instrument" ? <InstrumentDemo /> : null}
          {selected === "cabinet" ? <CabinetDemo /> : null}
          {selected === "place" ? <PlaceDemo /> : null}
          {selected === "ritual" ? <RitualDemo /> : null}
          {selected === "receiver" ? <ReceiverDemo /> : null}
        </View>

        <View style={styles.notes}>
          <Text style={styles.noteTitle}>Design rule</Text>
          <Text style={styles.noteCopy}>
            The UI can be strange, but the next action should stay obvious.
            Homage can feel like a field notebook, instrument, cabinet, or
            receiver without hiding the core loop: arrive, write, seal, archive.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function NotebookDemo() {
  return (
    <View style={styles.notebook}>
      <View style={styles.notebookLine} />
      <Text style={styles.notebookDate}>July 6 / local signal</Text>
      <Text style={styles.notebookTitle}>Write from here</Text>
      <Text style={styles.handLine}>The courthouse throws a shadow across the square.</Text>
      <Text style={styles.handLine}>A document begins as an observation.</Text>
      <View style={styles.noteChips}>
        <Text style={styles.noteChip}>GPS 3/3</Text>
        <Text style={styles.noteChip}>PDF ready</Text>
        <Text style={styles.noteChip}>Archive local</Text>
      </View>
      <Pressable style={styles.paperButton}>
        <Text style={styles.paperButtonText}>Begin Page</Text>
      </Pressable>
    </View>
  );
}

function InstrumentDemo() {
  return (
    <View style={styles.instrument}>
      <View style={styles.gaugeRow}>
        <Gauge label="LOCATION" value="3/3" color={RGB_THEME.lime} />
        <Gauge label="ARCHIVE" value="12" color={RGB_THEME.amber} />
        <Gauge label="SIGNAL" value="DOC" color={RGB_THEME.cyan} />
      </View>
      <View style={styles.readout}>
        <Text style={styles.readoutText}>MODE: DOCUMENT STUDIO</Text>
        <Text style={styles.readoutText}>PLACE: PUBLIC SQUARE</Text>
        <Text style={styles.readoutText}>ACTION: WRITE / SEAL / STORE</Text>
      </View>
      <View style={styles.scope}>
        <View style={styles.scopeRing} />
        <View style={styles.scopeNeedle} />
        <Text style={styles.scopeText}>LOCAL NODE</Text>
      </View>
    </View>
  );
}

function Gauge({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={[styles.gauge, { borderColor: color }]}>
      <Text style={[styles.gaugeValue, { color }]}>{value}</Text>
      <Text style={styles.gaugeLabel}>{label}</Text>
    </View>
  );
}

function CabinetDemo() {
  const items = [
    ["A Signal in Grass", "PDF"],
    ["Noon Shadow Study", "TEX"],
    ["Square After Rain", "FIELD"],
    ["The Library Door", "NOTE"],
  ];
  return (
    <View style={styles.cabinet}>
      {items.map(([title, kind]) => (
        <View key={title} style={styles.drawer}>
          <View style={styles.drawerPull} />
          <View style={styles.drawerLabel}>
            <Text numberOfLines={1} style={styles.drawerTitle}>{title}</Text>
            <Text style={styles.drawerKind}>{kind}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function PlaceDemo() {
  const places = ["Courthouse", "Library", "Mural", "Bridge"];
  return (
    <View style={styles.placeDemo}>
      <Text style={styles.placePrompt}>No map. Just readable places nearby.</Text>
      {places.map((place, index) => (
        <View key={place} style={styles.placeRow}>
          <Text style={styles.placeIndex}>0{index + 1}</Text>
          <View style={styles.placeText}>
            <Text style={styles.placeName}>{place}</Text>
            <Text style={styles.placeHint}>
              {index === 0
                ? "civic reflection"
                : index === 1
                  ? "reading note"
                  : index === 2
                    ? "ekphrastic poem"
                    : "crossing story"}
            </Text>
          </View>
          <Text style={styles.placeDistance}>{120 + index * 70}m</Text>
        </View>
      ))}
    </View>
  );
}

function RitualDemo() {
  const steps = ["Arrive", "Observe", "Write", "Seal", "Archive"];
  return (
    <View style={styles.ritual}>
      {steps.map((step, index) => (
        <View key={step} style={styles.ritualStep}>
          <View
            style={[
              styles.ritualOrb,
              index < 2 && { backgroundColor: RGB_THEME.lime },
            ]}
          >
            <Text style={styles.ritualNumber}>{index + 1}</Text>
          </View>
          <Text style={[styles.ritualLabel, index < 2 && { color: RGB_THEME.lime }]}>
            {step}
          </Text>
        </View>
      ))}
      <View style={styles.seal}>
        <Text style={styles.sealText}>Seal Document</Text>
      </View>
    </View>
  );
}

function ReceiverDemo() {
  return (
    <View style={styles.receiver}>
      <View style={styles.tuner}>
        <View style={[styles.tunerBand, { width: "28%" }]} />
        <View style={[styles.tunerBand, { width: "62%" }]} />
        <View style={[styles.tunerBand, { width: "44%" }]} />
      </View>
      <Text style={styles.frequency}>88.7 LOCAL DOCUMENTS</Text>
      <View style={styles.signalRows}>
        <Text style={styles.signalLine}>nearby: 4 readable places</Text>
        <Text style={styles.signalLine}>archive: 12 saved artifacts</Text>
        <Text style={styles.signalLine}>mode: tune / write / collect</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: RGB_THEME.background, flex: 1 },
  content: { padding: 18, paddingBottom: 34 },
  header: { paddingTop: 6 },
  kicker: {
    color: RGB_THEME.cyan,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
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
    marginTop: 8,
  },
  tabs: { gap: 10, paddingVertical: 18 },
  tab: {
    alignItems: "center",
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  tabLight: { borderRadius: 4, height: 8, width: 8 },
  tabText: { color: RGB_THEME.muted, fontSize: 13, fontWeight: "800" },
  demoFrame: {
    backgroundColor: RGB_THEME.surface,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  demoHeader: {
    alignItems: "center",
    borderBottomColor: RGB_THEME.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 12,
  },
  demoKicker: { fontSize: 12, fontWeight: "900", letterSpacing: 0 },
  demoSignal: {
    color: RGB_THEME.text,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 3,
    maxWidth: 260,
  },
  beacon: {
    alignItems: "center",
    borderRadius: 19,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  beaconCore: { borderRadius: 6, height: 12, width: 12 },
  notebook: {
    backgroundColor: "#F1F1EF",
    borderRadius: 6,
    minHeight: 360,
    overflow: "hidden",
    padding: 18,
  },
  notebookLine: {
    backgroundColor: "#D54747",
    bottom: 0,
    left: 44,
    position: "absolute",
    top: 0,
    width: 1,
  },
  notebookDate: { color: "#59616C", fontSize: 12, fontWeight: "800" },
  notebookTitle: {
    color: "#171A1F",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 14,
  },
  handLine: {
    borderBottomColor: "#C9CFD6",
    borderBottomWidth: 1,
    color: "#20262E",
    fontSize: 17,
    lineHeight: 36,
    marginLeft: 42,
    marginTop: 10,
  },
  noteChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 22 },
  noteChip: {
    borderColor: "#949CA7",
    borderRadius: 4,
    borderWidth: 1,
    color: "#303842",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  paperButton: {
    alignItems: "center",
    backgroundColor: "#171A1F",
    borderRadius: 4,
    marginTop: 20,
    padding: 13,
  },
  paperButtonText: { color: "#F1F1EF", fontSize: 14, fontWeight: "900" },
  instrument: { gap: 14, minHeight: 360 },
  gaugeRow: { flexDirection: "row", gap: 10 },
  gauge: {
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 16,
  },
  gaugeValue: { fontSize: 22, fontWeight: "900" },
  gaugeLabel: {
    color: RGB_THEME.muted,
    fontSize: 10,
    fontWeight: "900",
    marginTop: 4,
  },
  readout: {
    backgroundColor: RGB_THEME.black,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  readoutText: {
    color: RGB_THEME.lime,
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: "800",
  },
  scope: {
    alignItems: "center",
    borderColor: RGB_THEME.borderStrong,
    borderRadius: 110,
    borderWidth: 1,
    height: 190,
    justifyContent: "center",
  },
  scopeRing: {
    borderColor: RGB_THEME.cyan,
    borderRadius: 65,
    borderWidth: 1,
    height: 130,
    position: "absolute",
    width: 130,
  },
  scopeNeedle: {
    backgroundColor: RGB_THEME.magenta,
    height: 2,
    position: "absolute",
    transform: [{ rotate: "-28deg" }],
    width: 122,
  },
  scopeText: { color: RGB_THEME.text, fontSize: 13, fontWeight: "900" },
  cabinet: { gap: 12, minHeight: 360 },
  drawer: {
    alignItems: "center",
    backgroundColor: "#2A241E",
    borderColor: "#725D45",
    borderRadius: 5,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 72,
    padding: 12,
  },
  drawerPull: {
    borderColor: RGB_THEME.amber,
    borderRadius: 14,
    borderWidth: 2,
    height: 28,
    marginRight: 12,
    width: 46,
  },
  drawerLabel: {
    backgroundColor: "#E8DEC6",
    borderColor: "#9A8768",
    borderRadius: 3,
    borderWidth: 1,
    flex: 1,
    padding: 10,
  },
  drawerTitle: { color: "#211A14", fontSize: 15, fontWeight: "900" },
  drawerKind: { color: "#725D45", fontSize: 11, fontWeight: "900", marginTop: 4 },
  placeDemo: { gap: 10, minHeight: 360 },
  placePrompt: {
    color: RGB_THEME.text,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 24,
    marginBottom: 6,
  },
  placeRow: {
    alignItems: "center",
    backgroundColor: RGB_THEME.black,
    borderColor: RGB_THEME.border,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 66,
    padding: 12,
  },
  placeIndex: { color: RGB_THEME.magenta, fontSize: 17, fontWeight: "900" },
  placeText: { flex: 1, marginLeft: 12 },
  placeName: { color: RGB_THEME.text, fontSize: 16, fontWeight: "900" },
  placeHint: { color: RGB_THEME.muted, fontSize: 12, marginTop: 3 },
  placeDistance: { color: RGB_THEME.amber, fontSize: 12, fontWeight: "900" },
  ritual: {
    alignItems: "center",
    gap: 12,
    minHeight: 360,
    paddingVertical: 12,
  },
  ritualStep: { alignItems: "center", flexDirection: "row", width: "100%" },
  ritualOrb: {
    alignItems: "center",
    borderColor: RGB_THEME.borderStrong,
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  ritualNumber: { color: RGB_THEME.black, fontSize: 14, fontWeight: "900" },
  ritualLabel: {
    color: RGB_THEME.muted,
    flex: 1,
    fontSize: 18,
    fontWeight: "900",
    marginLeft: 14,
  },
  seal: {
    alignItems: "center",
    borderColor: RGB_THEME.lime,
    borderRadius: 88,
    borderWidth: 2,
    height: 116,
    justifyContent: "center",
    marginTop: 14,
    width: 116,
  },
  sealText: {
    color: RGB_THEME.lime,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  receiver: { gap: 18, minHeight: 360 },
  tuner: {
    backgroundColor: RGB_THEME.black,
    borderColor: RGB_THEME.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 18,
  },
  tunerBand: {
    backgroundColor: RGB_THEME.cyan,
    borderRadius: 3,
    height: 8,
  },
  frequency: {
    color: RGB_THEME.cyan,
    fontSize: 25,
    fontWeight: "900",
  },
  signalRows: {
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  signalLine: {
    color: RGB_THEME.text,
    fontFamily: "monospace",
    fontSize: 13,
  },
  notes: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 16,
    padding: 14,
  },
  noteTitle: { color: RGB_THEME.amber, fontSize: 14, fontWeight: "900" },
  noteCopy: {
    color: RGB_THEME.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
});
