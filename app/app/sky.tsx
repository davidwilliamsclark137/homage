import { useEffect, useMemo, useState } from "react";
import {
  AppState,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { normalizeDegrees, skyQuality } from "../sky/astronomy";
import { CONSTELLATIONS } from "../sky/catalog";
import {
  calculateHorizontalStars,
  constellationCenter,
  projectHorizontalStars,
  projectStars,
} from "../sky/projection";
import { SkyOverlay } from "../sky/SkyOverlay";
import { HIPPARCOS_STARS } from "../sky/starCatalog";
import { useSkyPose } from "../sky/useSkyPose";

type DisplayMode = "all" | "focus";
type BackgroundMode = "natural" | "dim" | "synthetic";

const BACKGROUND_OPACITY: Record<BackgroundMode, number> = {
  natural: 0,
  dim: 0.32,
  synthetic: 0.78,
};
const SKY_CALIBRATION_KEY = "homage.skyCalibration.v1";
const DEFAULT_HORIZONTAL_FOV = 52;
const DEFAULT_VERTICAL_FOV = 68;

export default function SkyScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const skyPose = useSkyPose();
  const [selectedId, setSelectedId] = useState(CONSTELLATIONS[0].id);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("all");
  const [backgroundMode, setBackgroundMode] =
    useState<BackgroundMode>("dim");
  const [outsideConfirmed, setOutsideConfirmed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [headingOffset, setHeadingOffset] = useState(0);
  const [altitudeOffset, setAltitudeOffset] = useState(0);
  const [horizontalFov, setHorizontalFov] = useState(DEFAULT_HORIZONTAL_FOV);
  const [verticalFov, setVerticalFov] = useState(DEFAULT_VERTICAL_FOV);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    AsyncStorage.getItem(SKY_CALIBRATION_KEY)
      .then((raw) => {
        if (!raw) return;
        const calibration = JSON.parse(raw) as Partial<{
          headingOffset: number;
          altitudeOffset: number;
          horizontalFov: number;
          verticalFov: number;
        }>;
        if (Number.isFinite(calibration.headingOffset)) {
          setHeadingOffset(calibration.headingOffset!);
        }
        if (Number.isFinite(calibration.altitudeOffset)) {
          setAltitudeOffset(calibration.altitudeOffset!);
        }
        if (Number.isFinite(calibration.horizontalFov)) {
          setHorizontalFov(clamp(calibration.horizontalFov!, 38, 76));
        }
        if (Number.isFinite(calibration.verticalFov)) {
          setVerticalFov(clamp(calibration.verticalFov!, 48, 92));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(
      SKY_CALIBRATION_KEY,
      JSON.stringify({
        headingOffset,
        altitudeOffset,
        horizontalFov,
        verticalFov,
      }),
    ).catch(() => {});
  }, [altitudeOffset, headingOffset, horizontalFov, verticalFov]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") setOutsideConfirmed(false);
    });
    return () => subscription.remove();
  }, []);

  const constellation =
    CONSTELLATIONS.find((item) => item.id === selectedId) ?? CONSTELLATIONS[0];
  const correctedPose = useMemo(
    () => ({
      heading: normalizeDegrees(skyPose.heading + headingOffset),
      altitude: Math.max(
        -90,
        Math.min(90, skyPose.altitude + altitudeOffset),
      ),
      roll: skyPose.roll,
    }),
    [
      altitudeOffset,
      headingOffset,
      skyPose.altitude,
      skyPose.heading,
      skyPose.roll,
    ],
  );

  const projectedLayers = useMemo(() => {
    const observer = skyPose.observer;
    if (!observer || !viewport.width || !viewport.height) return [];
    return CONSTELLATIONS.map((item) => ({
      constellation: item,
      stars: projectStars({
        stars: item.stars,
        observer,
        date: now,
        pose: correctedPose,
        width: viewport.width,
        height: viewport.height,
        horizontalFovDegrees: horizontalFov,
        verticalFovDegrees: verticalFov,
      }),
    }));
  }, [
    correctedPose,
    horizontalFov,
    now,
    skyPose.observer,
    verticalFov,
    viewport.height,
    viewport.width,
  ]);

  const catalogLatitude = skyPose.observer
    ? Math.round(skyPose.observer.latitude * 10_000) / 10_000
    : null;
  const catalogLongitude = skyPose.observer
    ? Math.round(skyPose.observer.longitude * 10_000) / 10_000
    : null;
  const horizontalSkyStars = useMemo(() => {
    if (catalogLatitude === null || catalogLongitude === null) return [];
    return calculateHorizontalStars(
      HIPPARCOS_STARS,
      {
        latitude: catalogLatitude,
        longitude: catalogLongitude,
        elevationMeters: skyPose.observer?.elevationMeters,
      },
      now,
    );
  }, [catalogLatitude, catalogLongitude, now, skyPose.observer?.elevationMeters]);
  const projectedSkyStars = useMemo(() => {
    if (!viewport.width || !viewport.height) return [];
    return projectHorizontalStars({
      stars: horizontalSkyStars,
      pose: correctedPose,
      width: viewport.width,
      height: viewport.height,
      horizontalFovDegrees: horizontalFov,
      verticalFovDegrees: verticalFov,
      visibleOnly: true,
    });
  }, [
    correctedPose,
    horizontalFov,
    horizontalSkyStars,
    verticalFov,
    viewport.height,
    viewport.width,
  ]);

  const selectedLayer = projectedLayers.find(
    (layer) => layer.constellation.id === selectedId,
  );
  const stars = selectedLayer?.stars ?? [];
  const layersInFrame = projectedLayers.filter(
    (layer) =>
      layer.stars.some((star) => star.altitude >= 0) &&
      layer.stars.some((star) => star.onScreen),
  );
  const overlayLayers =
    displayMode === "all"
      ? layersInFrame
      : selectedLayer
        ? [selectedLayer]
        : [];
  const visibleStars = stars.filter((star) => star.onScreen).length;
  const isBelowHorizon =
    stars.length > 0 && stars.every((star) => star.altitude < 0);
  const visibleCatalogStars = projectedSkyStars.filter(
    (star) => star.altitude > 0,
  ).length;
  const locationFresh =
    skyPose.locationTimestamp !== null &&
    now.getTime() - skyPose.locationTimestamp < 15_000;
  const gpsReady =
    locationFresh &&
    skyPose.locationAccuracy !== null &&
    skyPose.locationAccuracy <= 35 &&
    skyPose.locationFixCount >= 3;
  const compassReady = skyPose.headingAccuracy >= 3;
  const outdoorSignalsReady =
    gpsReady && compassReady && skyPose.motionAvailable;
  const quality = skyPose.observer ? skyQuality(skyPose.observer, now) : null;

  useEffect(() => {
    if (!outdoorSignalsReady) setOutsideConfirmed(false);
  }, [outdoorSignalsReady]);

  async function begin() {
    if (starting) return;
    setStarting(true);
    try {
      if (!cameraPermission?.granted) {
        const result = await requestCameraPermission();
        if (!result.granted) return;
      }
      await skyPose.start();
    } finally {
      setStarting(false);
    }
  }

  function measureViewport(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setViewport({ width, height });
  }

  function alignSelectedToCenter() {
    const center = constellationCenter(stars);
    setHeadingOffset(shortestDegreeDelta(skyPose.heading, center.azimuth));
    setAltitudeOffset(center.altitude - skyPose.altitude);
  }

  function resetCalibration() {
    setHeadingOffset(0);
    setAltitudeOffset(0);
    setHorizontalFov(DEFAULT_HORIZONTAL_FOV);
    setVerticalFov(DEFAULT_VERTICAL_FOV);
  }

  if (!cameraPermission?.granted || !skyPose.running) {
    return (
      <View style={styles.permissionScreen}>
        <View style={styles.permissionBody}>
          <Text style={styles.kicker}>LIVE SKY</Text>
          <Text style={styles.permissionTitle}>Constellation scanner</Text>
          <Text style={styles.permissionCopy}>
            Camera, location, compass, and motion access align the star map with
            the sky above you.
          </Text>
          {!!skyPose.error && (
            <Text style={styles.errorText}>{skyPose.error}</Text>
          )}
          <Pressable
            disabled={starting}
            style={[
              styles.primaryButton,
              starting && styles.primaryButtonDisabled,
            ]}
            onPress={begin}
          >
            <Text style={styles.primaryButtonText}>
              {starting ? "Locating..." : "Start scanning"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!outdoorSignalsReady || !outsideConfirmed) {
    return (
      <View style={styles.permissionScreen}>
        <View style={styles.permissionBody}>
          <Text style={styles.kicker}>OUTDOOR CHECK</Text>
          <Text style={styles.permissionTitle}>Confirm the open sky</Text>

          <View style={styles.readinessList}>
            <ReadinessRow
              label="GPS"
              ready={gpsReady}
              value={
                skyPose.locationAccuracy === null
                  ? "Waiting"
                  : `${skyPose.locationFixCount}/3 · ±${Math.round(skyPose.locationAccuracy)} m`
              }
            />
            <ReadinessRow
              label="Compass"
              ready={compassReady}
              value={compassReady ? "Ready" : "Calibrating"}
            />
            <ReadinessRow
              label="Motion"
              ready={skyPose.motionAvailable}
              value={skyPose.motionAvailable ? "Ready" : "Unavailable"}
            />
          </View>
          {!!skyPose.error && (
            <Text style={styles.errorText}>{skyPose.error}</Text>
          )}

          <Pressable
            disabled={!outdoorSignalsReady}
            style={[
              styles.primaryButton,
              !outdoorSignalsReady && styles.primaryButtonDisabled,
            ]}
            onPress={() => setOutsideConfirmed(true)}
          >
            <Text style={styles.primaryButtonText}>I am outside</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const instruction = isBelowHorizon
    ? `${constellation.name} is below the horizon right now`
    : visibleStars >= 3
      ? `${constellation.name} is outlined at its predicted position`
      : `Move toward ${Math.round(constellationCenter(stars).azimuth)}° · ${Math.round(constellationCenter(stars).altitude)}° high`;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.cameraArea} onLayout={measureViewport}>
        <CameraView style={StyleSheet.absoluteFill} facing="back" />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: `rgba(2, 6, 23, ${BACKGROUND_OPACITY[backgroundMode]})`,
            },
          ]}
        />
        {viewport.width > 0 && (
          <SkyOverlay
            layers={overlayLayers}
            skyStars={projectedSkyStars}
            selectedId={selectedId}
            showStarNames={displayMode === "focus"}
            starBoost={
              backgroundMode === "natural"
                ? 0.82
                : backgroundMode === "dim"
                  ? 1
                  : 1.16
            }
            width={viewport.width}
            height={viewport.height}
          />
        )}

        <View style={styles.readout}>
          <Text style={styles.readoutName}>{constellation.name}</Text>
          <Text style={styles.readoutDetail}>{instruction}</Text>
        </View>

        <View style={styles.compass}>
          <Text style={styles.compassText}>
            {Math.round(correctedPose.heading)}° ·{" "}
            {Math.round(correctedPose.altitude)}° altitude ·{" "}
            {visibleCatalogStars} stars
          </Text>
          {quality ? (
            <Text style={styles.qualityText}>
              {quality.twilight} · moon{" "}
              {Math.round(quality.moonPhaseFraction * 100)}% ·{" "}
              {Math.round(quality.moonAltitude)}°
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.modeRow}>
          <View style={styles.segmentedControl}>
            {(["all", "focus"] as DisplayMode[]).map((mode) => (
              <Pressable
                key={mode}
                style={[
                  styles.segment,
                  displayMode === mode && styles.segmentActive,
                ]}
                onPress={() => setDisplayMode(mode)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    displayMode === mode && styles.segmentTextActive,
                  ]}
                >
                  {mode === "all" ? "Visible sky" : "Focus"}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.segmentedControl}>
            {(["natural", "dim", "synthetic"] as BackgroundMode[]).map(
              (mode) => (
                <Pressable
                  key={mode}
                  accessibilityLabel={`${mode} camera background`}
                  style={[
                    styles.backgroundSegment,
                    backgroundMode === mode && styles.segmentActive,
                  ]}
                  onPress={() => setBackgroundMode(mode)}
                >
                  <Text
                    style={[
                      styles.backgroundText,
                      backgroundMode === mode && styles.segmentTextActive,
                    ]}
                  >
                    {mode === "natural" ? "○" : mode === "dim" ? "◐" : "●"}
                  </Text>
                </Pressable>
              ),
            )}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.constellationPicker}
        >
          {CONSTELLATIONS.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setSelectedId(item.id)}
              style={[
                styles.constellationOption,
                item.id === constellation.id && styles.constellationOptionActive,
              ]}
            >
              <Text
                style={[
                  styles.constellationText,
                  item.id === constellation.id && styles.constellationTextActive,
                ]}
              >
                {item.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.calibrationRow}>
          <Text style={styles.calibrationLabel}>Alignment</Text>
          <Pressable
            accessibilityLabel="Move overlay left"
            style={styles.iconButton}
            onPress={() => setHeadingOffset((value) => value - 2)}
          >
            <Text style={styles.iconText}>←</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Move overlay right"
            style={styles.iconButton}
            onPress={() => setHeadingOffset((value) => value + 2)}
          >
            <Text style={styles.iconText}>→</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Move overlay down"
            style={styles.iconButton}
            onPress={() => setAltitudeOffset((value) => value - 2)}
          >
            <Text style={styles.iconText}>↓</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Move overlay up"
            style={styles.iconButton}
            onPress={() => setAltitudeOffset((value) => value + 2)}
          >
            <Text style={styles.iconText}>↑</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Align selected constellation to center"
            disabled={!stars.length}
            style={[styles.alignButton, !stars.length && styles.disabledButton]}
            onPress={alignSelectedToCenter}
          >
            <Text style={styles.alignText}>Align</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Reset alignment"
            style={styles.resetButton}
            onPress={resetCalibration}
          >
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
        </View>
        <View style={styles.calibrationRow}>
          <Text style={styles.calibrationLabel}>
            Lens {Math.round(horizontalFov)}° / {Math.round(verticalFov)}°
          </Text>
          <Pressable
            accessibilityLabel="Narrow camera field of view"
            style={styles.fovButton}
            onPress={() => {
              setHorizontalFov((value) => clamp(value - 2, 38, 76));
              setVerticalFov((value) => clamp(value - 2, 48, 92));
            }}
          >
            <Text style={styles.resetText}>Narrow</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Widen camera field of view"
            style={styles.fovButton}
            onPress={() => {
              setHorizontalFov((value) => clamp(value + 2, 38, 76));
              setVerticalFov((value) => clamp(value + 2, 48, 92));
            }}
          >
            <Text style={styles.resetText}>Wide</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function shortestDegreeDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function ReadinessRow({
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
      <View
        style={[
          styles.readinessIndicator,
          ready && styles.readinessIndicatorReady,
        ]}
      />
      <Text style={styles.readinessLabel}>{label}</Text>
      <Text style={[styles.readinessValue, ready && styles.readinessValueReady]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#05070a" },
  cameraArea: { flex: 1, overflow: "hidden", backgroundColor: "#05070a" },
  permissionScreen: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "#090c10",
  },
  permissionBody: { padding: 24, paddingBottom: 48 },
  kicker: { color: "#67e8f9", fontSize: 12, fontWeight: "800" },
  permissionTitle: {
    color: "white",
    fontSize: 30,
    fontWeight: "800",
    marginTop: 8,
  },
  permissionCopy: {
    color: "#cbd5e1",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 440,
  },
  errorText: { color: "#fca5a5", fontSize: 14, marginTop: 16 },
  readinessList: {
    borderBottomColor: "#27303a",
    borderTopColor: "#27303a",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 24,
    paddingVertical: 6,
  },
  readinessRow: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 42,
  },
  readinessIndicator: {
    backgroundColor: "#64748b",
    borderRadius: 4,
    height: 8,
    marginRight: 10,
    width: 8,
  },
  readinessIndicatorReady: { backgroundColor: "#22c55e" },
  readinessLabel: { color: "#e2e8f0", flex: 1, fontSize: 15 },
  readinessValue: { color: "#94a3b8", fontSize: 14, fontWeight: "700" },
  readinessValueReady: { color: "#bbf7d0" },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    marginTop: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryButtonDisabled: { opacity: 0.42 },
  primaryButtonText: { color: "#090c10", fontSize: 16, fontWeight: "800" },
  readout: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
  },
  readoutName: { color: "white", fontSize: 24, fontWeight: "800" },
  readoutDetail: {
    color: "#e2e8f0",
    fontSize: 14,
    marginTop: 3,
    textShadowColor: "#000",
    textShadowRadius: 4,
  },
  compass: {
    position: "absolute",
    bottom: 14,
    alignSelf: "center",
    backgroundColor: "rgba(3, 7, 18, 0.72)",
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  compassText: { color: "#f8fafc", fontSize: 12, fontWeight: "700" },
  qualityText: {
    color: "#cbd5e1",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
    textAlign: "center",
  },
  controls: {
    backgroundColor: "#090c10",
    borderTopColor: "#27303a",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 14,
  },
  modeRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  segmentedControl: {
    borderColor: "#334155",
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  segment: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    minWidth: 78,
    paddingHorizontal: 10,
  },
  backgroundSegment: {
    alignItems: "center",
    height: 34,
    justifyContent: "center",
    width: 38,
  },
  segmentActive: { backgroundColor: "#e2e8f0" },
  segmentText: { color: "#94a3b8", fontSize: 12, fontWeight: "800" },
  segmentTextActive: { color: "#090c10" },
  backgroundText: { color: "#94a3b8", fontSize: 17 },
  constellationPicker: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  constellationOption: {
    borderBottomColor: "transparent",
    borderBottomWidth: 2,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  constellationOptionActive: { borderBottomColor: "#67e8f9" },
  constellationText: { color: "#94a3b8", fontSize: 14, fontWeight: "700" },
  constellationTextActive: { color: "#ffffff" },
  calibrationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
  },
  calibrationLabel: {
    color: "#94a3b8",
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  iconButton: {
    alignItems: "center",
    borderColor: "#334155",
    borderRadius: 4,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  iconText: { color: "#f8fafc", fontSize: 20, lineHeight: 22 },
  alignButton: {
    alignItems: "center",
    borderColor: "#67e8f9",
    borderRadius: 4,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  alignText: { color: "#67e8f9", fontSize: 12, fontWeight: "800" },
  disabledButton: { opacity: 0.35 },
  fovButton: {
    alignItems: "center",
    borderColor: "#334155",
    borderRadius: 4,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  resetButton: { paddingHorizontal: 5, paddingVertical: 9 },
  resetText: { color: "#67e8f9", fontSize: 12, fontWeight: "800" },
});
