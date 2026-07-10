import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import Svg, { Circle, Line } from "react-native-svg";

import { CONSTELLATIONS } from "../sky/catalog";
import {
  calculateHorizontalStars,
  projectHorizontalStars,
  projectStars,
} from "../sky/projection";
import { SkyOverlay } from "../sky/SkyOverlay";
import { sunToHorizontal } from "../sky/solar";
import { HIPPARCOS_STARS } from "../sky/starCatalog";
import { useSkyPose } from "../sky/useSkyPose";
import { RGB_THEME } from "../lib/theme";

type Props = {
  visible: boolean;
  placeName: string;
  onClose: () => void;
  onComplete: (targetName: string) => void;
};

export default function SkyQuestModal({
  visible,
  placeName,
  onClose,
  onComplete,
}: Props) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const skyPose = useSkyPose();
  const stopSkyPose = skyPose.stop;
  const [starting, setStarting] = useState(false);
  const [outsideConfirmed, setOutsideConfirmed] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!visible) {
      stopSkyPose();
      setOutsideConfirmed(false);
      return;
    }
    const timer = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(timer);
  }, [stopSkyPose, visible]);

  const observer = skyPose.observer;
  const sun = useMemo(
    () => (observer ? sunToHorizontal(observer, now) : null),
    [now, observer],
  );
  const daylight = (sun?.altitude ?? -90) > -6;

  const constellation = useMemo(() => {
    if (!observer) return CONSTELLATIONS[0];
    return [...CONSTELLATIONS].sort((first, second) => {
      const firstAltitude = averageAltitude(first.stars, observer, now);
      const secondAltitude = averageAltitude(second.stars, observer, now);
      return secondAltitude - firstAltitude;
    })[0];
  }, [now, observer]);

  const constellationStars = useMemo(() => {
    if (!observer || !viewport.width || !viewport.height) return [];
    return projectStars({
      stars: constellation.stars,
      observer,
      date: now,
      pose: skyPose,
      width: viewport.width,
      height: viewport.height,
    });
  }, [
    constellation.stars,
    now,
    observer,
    skyPose,
    viewport.height,
    viewport.width,
  ]);

  const skyStars = useMemo(() => {
    if (!observer || !viewport.width || !viewport.height) return [];
    return projectHorizontalStars({
      stars: calculateHorizontalStars(HIPPARCOS_STARS, observer, now),
      pose: skyPose,
      width: viewport.width,
      height: viewport.height,
      visibleOnly: true,
    });
  }, [now, observer, skyPose, viewport.height, viewport.width]);

  const projectedSun = useMemo(() => {
    if (!sun || !viewport.width || !viewport.height) return null;
    return projectHorizontalStars({
      stars: [
        {
          id: "sun",
          name: "Sun",
          magnitude: -26.74,
          rightAscensionHours: 0,
          declinationDegrees: 0,
          ...sun,
        },
      ],
      pose: skyPose,
      width: viewport.width,
      height: viewport.height,
    })[0];
  }, [skyPose, sun, viewport.height, viewport.width]);

  const locationFresh =
    skyPose.locationTimestamp !== null &&
    now.getTime() - skyPose.locationTimestamp < 15_000;
  const gpsReady =
    locationFresh &&
    skyPose.locationAccuracy !== null &&
    skyPose.locationAccuracy <= 35 &&
    skyPose.locationFixCount >= 3;
  const compassReady =
    skyPose.headingAccuracy >= (Platform.OS === "android" ? 2 : 3);
  const outdoorReady =
    gpsReady && compassReady && skyPose.motionAvailable;
  const visibleConstellationStars = constellationStars.filter(
    (star) => star.onScreen && star.altitude > 0,
  ).length;
  const aligned = daylight
    ? Boolean(projectedSun?.onScreen && projectedSun.altitude > 0)
    : visibleConstellationStars >= 3;
  const targetName = daylight ? "the Sun's bearing" : constellation.name;

  useEffect(() => {
    if (!outdoorReady) setOutsideConfirmed(false);
  }, [outdoorReady]);

  async function start() {
    if (starting) return;
    setStarting(true);
    try {
      if (!cameraPermission?.granted) {
        const permission = await requestCameraPermission();
        if (!permission.granted) return;
      }
      await skyPose.start();
    } finally {
      setStarting(false);
    }
  }

  function measure(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setViewport({ width, height });
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      visible={visible}
    >
      <SafeAreaView style={styles.screen}>
        {!cameraPermission?.granted || !skyPose.running ? (
          <View style={styles.setup}>
            <Text style={styles.kicker}>FINAL SIGNAL</Text>
            <Text style={styles.setupTitle}>Read the sky above {placeName}</Text>
            <Text style={styles.setupCopy}>
              Location, compass, motion, and the current time determine the
              object you must find.
            </Text>
            {skyPose.error ? (
              <Text style={styles.error}>{skyPose.error}</Text>
            ) : null}
            <Pressable
              disabled={starting}
              onPress={() => void start()}
              style={[styles.primaryButton, starting && styles.disabled]}
            >
              {starting ? (
                <ActivityIndicator color={RGB_THEME.black} />
              ) : (
                <Text style={styles.primaryText}>Start sky lens</Text>
              )}
            </Pressable>
            <Pressable onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Return to map</Text>
            </Pressable>
          </View>
        ) : !outsideConfirmed ? (
          <View style={styles.setup}>
            <Text style={styles.kicker}>OUTDOOR CHECK</Text>
            <Text style={styles.setupTitle}>Establish an open-sky fix</Text>
            <View style={styles.readiness}>
              <Readiness
                label="GPS"
                ready={gpsReady}
                value={
                  skyPose.locationAccuracy === null
                    ? "Waiting"
                    : `${skyPose.locationFixCount}/3 · ±${Math.round(skyPose.locationAccuracy)} m`
                }
              />
              <Readiness
                label="Compass"
                ready={compassReady}
                value={compassReady ? "Ready" : "Calibrating"}
              />
              <Readiness
                label="Motion"
                ready={skyPose.motionAvailable}
                value={skyPose.motionAvailable ? "Ready" : "Unavailable"}
              />
            </View>
            <Pressable
              disabled={!outdoorReady}
              onPress={() => setOutsideConfirmed(true)}
              style={[styles.primaryButton, !outdoorReady && styles.disabled]}
            >
              <Text style={styles.primaryText}>I am outside</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Return to map</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.scanner}>
            <View onLayout={measure} style={styles.camera}>
              <CameraView facing="back" style={StyleSheet.absoluteFill} />
              <View pointerEvents="none" style={styles.dimmer} />

              {viewport.width > 0 ? (
                daylight ? (
                  <SunOverlay
                    height={viewport.height}
                    sun={projectedSun}
                    width={viewport.width}
                  />
                ) : (
                  <SkyOverlay
                    height={viewport.height}
                    layers={[
                      {
                        constellation,
                        stars: constellationStars,
                      },
                    ]}
                    selectedId={constellation.id}
                    showStarNames
                    skyStars={skyStars}
                    starBoost={1.1}
                    width={viewport.width}
                  />
                )
              ) : null}

              <View style={styles.readout}>
                <Text style={styles.target}>{targetName}</Text>
                <Text style={styles.instruction}>
                  {aligned
                    ? "Signal aligned. Hold steady and lock it."
                    : daylight
                      ? `Use the screen only. Turn toward ${Math.round(sun?.azimuth ?? 0)}° and raise the phone ${Math.max(0, Math.round(sun?.altitude ?? 0))}°; never look directly at the Sun`
                      : `Move until at least three ${constellation.name} stars enter the frame`}
                </Text>
              </View>
            </View>

            <View style={styles.scannerActions}>
              <Pressable onPress={onClose} style={styles.backButton}>
                <Text style={styles.backText}>Back</Text>
              </Pressable>
              <Pressable
                disabled={!aligned}
                onPress={() => onComplete(targetName)}
                style={[styles.lockButton, !aligned && styles.disabled]}
              >
                <Text style={styles.lockText}>Lock sky signal</Text>
              </Pressable>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function averageAltitude(
  stars: (typeof CONSTELLATIONS)[number]["stars"],
  observer: { latitude: number; longitude: number },
  date: Date,
) {
  const positions = calculateHorizontalStars(stars, observer, date);
  return (
    positions.reduce((sum, star) => sum + star.altitude, 0) /
    Math.max(1, positions.length)
  );
}

function Readiness({
  label,
  ready,
  value,
}: {
  label: string;
  ready: boolean;
  value: string;
}) {
  return (
    <View style={styles.readinessRow}>
      <View style={[styles.dot, ready && styles.dotReady]} />
      <Text style={styles.readinessLabel}>{label}</Text>
      <Text style={styles.readinessValue}>{value}</Text>
    </View>
  );
}

function SunOverlay({
  sun,
  width,
  height,
}: {
  sun: { x: number; y: number; onScreen: boolean } | null;
  width: number;
  height: number;
}) {
  return (
    <Svg
      height={height}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width={width}
    >
      {sun?.onScreen ? (
        <>
          <Circle
            cx={sun.x}
            cy={sun.y}
            fill="rgba(250,204,21,0.22)"
            r={36}
            stroke="#fde047"
            strokeWidth={3}
          />
          <Circle cx={sun.x} cy={sun.y} fill="#fef08a" r={8} />
        </>
      ) : null}
      <Line
        stroke={RGB_THEME.text}
        strokeWidth={1}
        x1={width / 2 - 12}
        x2={width / 2 + 12}
        y1={height / 2}
        y2={height / 2}
      />
      <Line
        stroke={RGB_THEME.text}
        strokeWidth={1}
        x1={width / 2}
        x2={width / 2}
        y1={height / 2 - 12}
        y2={height / 2 + 12}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: RGB_THEME.background, flex: 1 },
  setup: { flex: 1, justifyContent: "flex-end", padding: 24, paddingBottom: 44 },
  kicker: { color: RGB_THEME.magenta, fontSize: 12, fontWeight: "900" },
  setupTitle: {
    color: RGB_THEME.text,
    fontSize: 30,
    fontWeight: "800",
    marginTop: 8,
  },
  setupCopy: {
    color: RGB_THEME.muted,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 12,
  },
  error: { color: RGB_THEME.danger, fontSize: 13, marginTop: 16 },
  primaryButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.cyan,
    borderRadius: 6,
    justifyContent: "center",
    marginTop: 24,
    minHeight: 52,
  },
  primaryText: { color: RGB_THEME.black, fontSize: 16, fontWeight: "900" },
  cancelButton: { alignItems: "center", minHeight: 48, paddingTop: 16 },
  cancelText: { color: RGB_THEME.muted, fontSize: 14, fontWeight: "700" },
  readiness: {
    borderBottomColor: RGB_THEME.border,
    borderBottomWidth: 1,
    borderTopColor: RGB_THEME.border,
    borderTopWidth: 1,
    marginTop: 24,
    paddingVertical: 6,
  },
  readinessRow: { alignItems: "center", flexDirection: "row", minHeight: 44 },
  dot: {
    backgroundColor: RGB_THEME.dim,
    borderRadius: 4,
    height: 8,
    marginRight: 10,
    width: 8,
  },
  dotReady: { backgroundColor: RGB_THEME.lime },
  readinessLabel: { color: RGB_THEME.text, flex: 1, fontSize: 15 },
  readinessValue: { color: RGB_THEME.muted, fontSize: 13, fontWeight: "700" },
  scanner: { flex: 1 },
  camera: { backgroundColor: "#020617", flex: 1, overflow: "hidden" },
  dimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,6,23,0.34)",
  },
  readout: { left: 16, position: "absolute", right: 16, top: 16 },
  target: { color: RGB_THEME.text, fontSize: 26, fontWeight: "900" },
  instruction: {
    color: RGB_THEME.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    textShadowColor: "#000000",
    textShadowRadius: 4,
  },
  scannerActions: {
    backgroundColor: RGB_THEME.background,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 50,
    width: 86,
  },
  backText: { color: RGB_THEME.text, fontSize: 14, fontWeight: "800" },
  lockButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.lime,
    borderRadius: 4,
    flex: 1,
    justifyContent: "center",
    minHeight: 50,
  },
  lockText: { color: RGB_THEME.black, fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.42 },
});
