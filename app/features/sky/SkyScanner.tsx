import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, Share, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SkyOverlay } from "./SkyOverlay";
import { projectStars } from "@mckinney/star-engine";
import { useSkyPose } from "@mckinney/star-expo";
import {
  ENGINE_VERSION,
  alignmentStatus,
  skyTargets,
  type Observer,
} from "@mckinney/star-engine";
import { advanceSkyHold, emptyHold } from "@mckinney/star-engine";
import { skyStyles as s } from "./styles";

export default function SkyScanner({
  test = false,
  active,
  onScan,
  laboratory = false,
  region,
}: {
  test?: boolean;
  active: boolean;
  onScan: (id: string, report?: string) => void;
  laboratory?: boolean;
  region?: { center: Observer; radiusMeters: number };
}) {
  const pose = useSkyPose();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [verticalFov, setVerticalFov] = useState(68);
  const trace = useRef<string[]>([]);
  const lastTrace = useRef(0);
  const [now, setNow] = useState(Date.now());
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const held = useRef(emptyHold());
  const [holdMs, setHoldMs] = useState(0);
  const captured = useRef(false);
  const live = useRef(true);
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const { stop } = pose;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!active) {
      stop();
      setStarted(false);
      setCameraReady(false);
      held.current = emptyHold();
      setHoldMs(0);
    }
  }, [active, stop]);
  const second = Math.floor(now / 1000);
  const targets = useMemo(
    () =>
      pose.observer
        ? skyTargets(
            pose.observer,
            new Date(second * 1000),
            laboratory ? "anchor" : "pattern",
          )
        : [],
    [pose.observer, second, laboratory],
  );
  const candidate = selected
    ? targets.find((t) => t.constellation.id === selected)
    : targets[0];
  const targetId = candidate?.constellation.id;
  useEffect(() => {
    held.current = emptyHold();
    setHoldMs(0);
  }, [targetId]);
  // Sample the clock after the sensor snapshot. The UI tick can predate a
  // just-arrived reading and must not make that reading appear future-dated.
  const scanTime = Date.now();
  const status = alignmentStatus(
    {
      observer: pose.observer,
      accuracy: pose.locationAccuracy,
      locationTimestamp: pose.locationTimestamp,
      qualityTimestamp: pose.qualityTimestamp,
      headingAccuracy: pose.headingAccuracy,
      headingTimestamp: pose.headingTimestamp,
      motionTimestamp: pose.motionTimestamp,
      heading: pose.heading,
      altitude: pose.altitude,
      now: scanTime,
      target: candidate?.target ?? null,
    },
    region,
  );
  const ready =
    active &&
    started &&
    cameraReady &&
    pose.running &&
    !pose.error &&
    status.ready === true;
  const report = `McKinney Star Engine ${ENGINE_VERSION} · diagnostic schema 1 · ${Platform.OS} ${Platform.Version} · hardware UNVERIFIED\nTarget: ${candidate?.anchor ?? "none"} (${targetId ?? "none"})\nUTC: ${new Date(scanTime).toISOString()}\nCamera: ${pose.heading.toFixed(1)}° true north / ${pose.altitude.toFixed(1)}° up\nTarget direction: ${candidate?.target.azimuth.toFixed(1) ?? "?"}° / ${candidate?.target.altitude.toFixed(1) ?? "?"}° up\nRoll: ${pose.roll.toFixed(1)}° · Declination: ${pose.declination?.toFixed(2) ?? "?"}°\nQuality age: ${age(pose.qualityTimestamp, scanTime)} · Magnetic age: ${age(pose.headingTimestamp, scanTime)} · Motion age: ${age(pose.motionTimestamp, scanTime)}\nGravity: ${pose.gravityNorm?.toFixed(3) ?? "?"} g · Field: ${pose.magneticNorm?.toFixed(1) ?? "?"} µT\nViewport: ${Math.round(viewport.width)} × ${Math.round(viewport.height)} · Vertical FOV: ${verticalFov}° (unverified estimate)\nStatus: ${status.message}\nSensor error: ${pose.error ?? "none"} · Camera error: ${error || "none"}\nCompass quality: ${pose.headingAccuracy}/3 · GPS accuracy: ${pose.locationAccuracy?.toFixed(0) ?? "?"} m\nAim error: ${status.offset?.toFixed(1) ?? "?"}°\nCapture checks directional alignment, not image recognition.`;
  const reportRef = useRef(report);
  reportRef.current = report;
  function evidence(outcome: string) {
    return `${reportRef.current}\nOutcome: ${outcome}\nTrace columns: UTC,target,heading,altitude,roll,offset,holdMs,qualityAgeMs,magAgeMs,motionAgeMs\n${trace.current.join("\n")}`;
  }

  useEffect(() => {
    held.current = advanceSkyHold(
      held.current,
      Date.now(),
      targetId ?? null,
      ready,
      status.offset ?? Infinity,
    );
    setHoldMs(held.current.elapsed);
    if (started && now - lastTrace.current >= 500) {
      lastTrace.current = now;
      const sampleTime = Date.now();
      trace.current.push(
        [
          new Date(sampleTime).toISOString(),
          targetId ?? "none",
          pose.heading.toFixed(2),
          pose.altitude.toFixed(2),
          pose.roll.toFixed(2),
          status.offset?.toFixed(2) ?? "invalid",
          held.current.elapsed,
          ...[
            pose.qualityTimestamp,
            pose.headingTimestamp,
            pose.motionTimestamp,
          ].map((t) => (t === null ? "none" : sampleTime - t)),
        ].join(","),
      );
      if (trace.current.length > 120) trace.current.shift();
    }
    if (held.current.elapsed >= 3000 && !captured.current && targetId) {
      captured.current = true;
      stop();
      onScan(
        targetId,
        evidence("direction acquired; visual agreement not yet recorded"),
      );
    }
  }, [ready, status.offset, now, targetId, onScan, stop]);
  const displayConstellation =
    candidate && laboratory
      ? {
          ...candidate.constellation,
          stars: candidate.constellation.stars.filter(
            (star) => star.name === candidate.anchor,
          ),
          segments: [] as [string, string][],
        }
      : candidate?.constellation;
  const stars =
    candidate && pose.observer && viewport.width
      ? projectStars({
          stars: displayConstellation!.stars,
          observer: pose.observer,
          date: new Date(second * 1000),
          pose,
          width: viewport.width,
          height: viewport.height,
          verticalFovDegrees: verticalFov,
          horizontalFovDegrees:
            (2 *
              Math.atan(
                (Math.tan((verticalFov * Math.PI) / 360) * viewport.width) /
                  viewport.height,
              ) *
              180) /
            Math.PI,
        })
      : [];
  async function start() {
    setStarting(true);
    setError("");
    captured.current = false;
    trace.current = [];
    held.current = emptyHold();
    setHoldMs(0);
    try {
      const p = await requestPermission();
      if (!live.current || !activeRef.current) return;
      if (!p.granted) {
        setError(
          "Allow camera access to line up the sky. You can also use the separate test mode.",
        );
        return;
      }
      setStarted(true);
      await pose.start();
    } catch {
      setError("The sky camera could not start. Please try again.");
    } finally {
      if (live.current) setStarting(false);
    }
  }
  if (test)
    return (
      <View style={s.card}>
        <Text style={s.title}>{"Begin with Cygnus"}</Text>
        <Text style={s.copy}>
          {
            "TEST MODE · This simulates a constellation scan. No camera, night sky, or location is required. Use this mode on both phones."
          }
        </Text>
        <Pressable
          accessibilityRole="button"
          style={s.button}
          onPress={() => onScan("cygnus")}
        >
          <Text style={s.buttonText}>{"Simulate Cygnus scan"}</Text>
        </Pressable>
      </View>
    );
  return (
    <View style={s.card}>
      <Text style={s.title}>
        {laboratory ? "Acquire one bright star" : "Find the same sky"}
      </Text>
      <Text style={s.copy}>
        {laboratory
          ? "Outside after dark, choose one bright star. Use the direction below to bring it to the crosshair, then hold for 3 seconds. This test works outside downtown too."
          : "Outside in downtown McKinney, choose the same constellation on both phones. Center its bright anchor star and hold steady for 3 seconds."}
      </Text>
      <Text style={s.small}>
        {
          "This uses compass and motion alignment, not photo recognition. Clouds, buildings, and compass interference can affect the experience."
        }
      </Text>
      {Platform.OS === "web" ? (
        <Text style={s.notice}>
          {
            "Open this screen in Expo Go on your phone to test the real camera and sensors."
          }
        </Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={starting || !active}
          style={s.button}
          onPress={() => void start()}
        >
          <Text style={s.buttonText}>
            {starting
              ? "Starting sensors…"
              : started
                ? "Restart sky sensors"
                : "Open sky camera"}
          </Text>
        </Pressable>
      )}
      {started && permission?.granted && active && Platform.OS !== "web" && (
        <View
          style={{ height: 330, overflow: "hidden", borderRadius: 18 }}
          onLayout={(e) => setViewport(e.nativeEvent.layout)}
        >
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            onCameraReady={() => setCameraReady(true)}
            onMountError={() => {
              setCameraReady(false);
              setError("Camera unavailable. Restart the sky sensors.");
            }}
          />
          <SkyOverlay
            layers={
              displayConstellation
                ? [{ constellation: displayConstellation, stars }]
                : []
            }
            skyStars={[]}
            selectedId={targetId ?? ""}
            showStarNames
            starBoost={1}
            width={viewport.width}
            height={viewport.height}
          />
        </View>
      )}
      {pose.observer && !targets.length && (
        <Text style={s.notice}>
          {
            "No supported anchor is between 12° and 80° in a dark sky. Try after dark."
          }
        </Text>
      )}
      {targets.map((t) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: targetId === t.constellation.id }}
          key={t.constellation.id}
          onPress={() => {
            held.current = emptyHold();
            setHoldMs(0);
            setSelected(t.constellation.id);
          }}
          style={s.choice}
        >
          <Text style={s.copy}>
            {targetId === t.constellation.id ? "✦ " : "○ "}
            {laboratory
              ? t.anchor + " · " + t.constellation.name
              : t.constellation.name}
            {" · "}
            {Math.round(t.target.altitude)}
            {"° up"}
          </Text>
        </Pressable>
      ))}
      {candidate && (
        <Text style={s.copy}>
          {"Aim at "}
          {candidate.anchor}
          {": "}
          {Math.round(candidate.target.azimuth)}
          {"° from north, "}
          {Math.round(candidate.target.altitude)}
          {"° above the horizon."}
        </Text>
      )}
      {laboratory && candidate && pose.running && (
        <Text style={s.copy}>
          {guidance(
            candidate.target.azimuth - pose.heading,
            candidate.target.altitude - pose.altitude,
          )}
        </Text>
      )}
      {started && (
        <Text style={s.notice} accessibilityLiveRegion="polite">
          {ready && held.current.tracking
            ? (held.current.outsideSince !== null
                ? "Recenter gently · "
                : "Hold steady · ") +
              (holdMs / 1000).toFixed(1) +
              "/3 seconds"
            : !pose.running
              ? "Waiting for sky sensors to start…"
              : !cameraReady
                ? "Waiting for camera…"
                : status.message}
        </Text>
      )}
      {started && (
        <Text style={s.small}>
          {"Camera: "}
          {Math.round(pose.heading)}
          {"° from north · "}
          {Math.round(pose.altitude)}
          {"° up"}
          {"\n"}
          {"Compass quality: "}
          {pose.headingAccuracy}
          {"/3 · GPS: "}
          {pose.locationAccuracy === null
            ? "waiting"
            : Math.round(pose.locationAccuracy) + " m"}
        </Text>
      )}
      {laboratory && started && (
        <View style={s.choice}>
          <Text style={s.eyebrow}>{"LIVE DIAGNOSTICS"}</Text>
          <Text style={s.small}>
            {"Camera: "}
            {cameraReady ? "ready" : "waiting"}
            {" · Sensors: "}
            {pose.running ? "running" : "stopped"}
          </Text>
          <Text style={s.small}>
            {"GPS age: "}
            {age(pose.locationTimestamp, scanTime)}
            {" · Heading age: "}
            {age(pose.headingTimestamp, scanTime)}
            {" · Motion age: "}
            {age(pose.motionTimestamp, scanTime)}
          </Text>
          <Text style={s.small}>
            {"Quality age: "}
            {age(pose.qualityTimestamp, scanTime)}
            {" · Declination: "}
            {pose.declination?.toFixed(1) ?? "?"}
            {"° · Roll: "}
            {pose.roll.toFixed(1)}
            {"°"}
          </Text>
          <Text style={s.small}>
            {"Gravity: "}
            {pose.gravityNorm?.toFixed(2) ?? "?"}
            {" g · Field: "}
            {pose.magneticNorm?.toFixed(1) ?? "?"}
            {" µT"}
          </Text>
          <Text style={s.small}>
            {"Aim error: "}
            {status.offset === undefined
              ? "waiting for valid sensors"
              : status.offset.toFixed(1) + "°"}
            {" · Start within 7° · Keep within 10°"}
          </Text>
          <Text style={s.small}>
            {"Hold: "}
            {(holdMs / 1000).toFixed(1)}
            {" / 3 seconds · "}
            {held.current.tracking
              ? held.current.outsideSince === null
                ? "tracking"
                : "paused for wobble"
              : "not acquired"}
          </Text>
          <Text style={s.small}>
            {"Engine "}
            {ENGINE_VERSION}
            {" · "}
            {Platform.OS}
            {" · "}
            {new Date(scanTime).toLocaleTimeString()}
          </Text>
        </View>
      )}
      {started && (
        <View style={s.choice}>
          <Text style={s.small}>
            {"Estimated vertical FOV: "}
            {verticalFov}
            {
              "°. Lens/crop uncalibrated; changing this affects marker scale, not acquisition."
            }
          </Text>
          <View style={{ flexDirection: "row", gap: 24 }}>
            <Pressable
              onPress={() => setVerticalFov((v) => Math.max(30, v - 2))}
            >
              <Text style={s.link}>{"FOV −2°"}</Text>
            </Pressable>
            <Pressable
              onPress={() => setVerticalFov((v) => Math.min(110, v + 2))}
            >
              <Text style={s.link}>{"FOV +2°"}</Text>
            </Pressable>
          </View>
          <Pressable
            style={s.choice}
            onPress={() =>
              void Share.share({
                message: evidence("diagnostic snapshot; no visual validation"),
              }).catch(() => setError("Sharing failed. Try again."))
            }
          >
            <Text style={s.copy}>{"Share current diagnostics"}</Text>
          </Pressable>
          <Pressable
            style={s.choice}
            onPress={() => {
              const snapshot = evidence("attempt ended without acquisition");
              stop();
              onScan(targetId ?? "none", snapshot);
            }}
          >
            <Text style={s.copy}>{"End attempt and record result"}</Text>
          </Pressable>
        </View>
      )}
      {!!(error || pose.error) && (
        <Text style={s.error}>{error || pose.error}</Text>
      )}
    </View>
  );
}

function age(timestamp: number | null, now: number) {
  return timestamp === null
    ? "none"
    : Math.max(0, (now - timestamp) / 1000).toFixed(1) + "s";
}

function guidance(heading: number, tilt: number) {
  const turn = ((heading + 540) % 360) - 180;
  return `${Math.abs(turn) < 3 ? "Bearing centered" : "Turn " + (turn > 0 ? "right" : "left") + " " + Math.round(Math.abs(turn)) + "°"} · ${Math.abs(tilt) < 3 ? "Tilt centered" : "Tilt " + (tilt > 0 ? "up" : "down") + " " + Math.round(Math.abs(tilt)) + "°"}`;
}
