import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import { DeviceMotion } from "expo-sensors";

import { haversine } from "../lib/geo";
import { normalizeDegrees } from "./astronomy";
import { Observer } from "./types";

type SkyPoseState = {
  observer: Observer | null;
  heading: number;
  altitude: number;
  roll: number;
  headingAccuracy: number;
  locationAccuracy: number | null;
  locationTimestamp: number | null;
  locationFixCount: number;
  motionAvailable: boolean;
  error: string | null;
  running: boolean;
};

const initialState: SkyPoseState = {
  observer: null,
  heading: 0,
  altitude: 0,
  roll: 0,
  headingAccuracy: 0,
  locationAccuracy: null,
  locationTimestamp: null,
  locationFixCount: 0,
  motionAvailable: false,
  error: null,
  running: false,
};

function blendAngle(previous: number, next: number, amount: number) {
  const delta = ((next - previous + 540) % 360) - 180;
  return normalizeDegrees(previous + delta * amount);
}

export function useSkyPose() {
  const [state, setState] = useState(initialState);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const headingSubscription = useRef<Location.LocationSubscription | null>(null);
  const motionSubscription = useRef<{ remove: () => void } | null>(null);

  const acceptLocation = useCallback((location: Location.LocationObject) => {
    const accuracy = location.coords.accuracy;
    if (accuracy === null || accuracy < 0) return;

    const observer = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      elevationMeters: location.coords.altitude ?? undefined,
    };
    const fresh = Date.now() - location.timestamp < 10_000;

    setState((current) => {
      const consistent =
        current.observer === null ||
        haversine(current.observer, observer) <=
          Math.max(60, accuracy + (current.locationAccuracy ?? accuracy));
      const qualityFix = fresh && accuracy <= 35 && consistent;

      return {
        ...current,
        observer,
        locationAccuracy: accuracy,
        locationTimestamp: location.timestamp,
        locationFixCount: qualityFix
          ? Math.min(3, current.locationFixCount + 1)
          : 0,
      };
    });
  }, []);

  const stop = useCallback(() => {
    locationSubscription.current?.remove();
    headingSubscription.current?.remove();
    motionSubscription.current?.remove();
    locationSubscription.current = null;
    headingSubscription.current = null;
    motionSubscription.current = null;
    setState((current) => ({ ...current, running: false }));
  }, []);

  const start = useCallback(async () => {
    setState((current) => ({ ...current, error: null }));

    try {
      const motionAvailable = await DeviceMotion.isAvailableAsync();
      if (!motionAvailable) {
        throw new Error("Device motion is not available on this phone.");
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        throw new Error("Location Services are disabled on this phone.");
      }
      if (Platform.OS === "android") {
        await Location.enableNetworkProviderAsync().catch(() => {});
      }

      const locationPermission =
        await Location.requestForegroundPermissionsAsync();
      const motionPermission = await DeviceMotion.requestPermissionsAsync();
      if (
        locationPermission.status !== "granted" ||
        motionPermission.status !== "granted"
      ) {
        throw new Error("Location and motion permissions are required.");
      }

      const firstLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      acceptLocation(firstLocation);
      setState((current) => ({
        ...current,
        motionAvailable,
        running: true,
      }));

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          distanceInterval: 0,
          timeInterval: 1_000,
        },
        acceptLocation,
        (reason) => {
          setState((current) => ({
            ...current,
            error: `Location update failed: ${reason}`,
            locationFixCount: 0,
          }));
        },
      );

      headingSubscription.current = await Location.watchHeadingAsync(
        (measurement) => {
          if (measurement.trueHeading < 0) {
            setState((current) => ({
              ...current,
              headingAccuracy: 0,
            }));
            return;
          }
          setState((current) => ({
            ...current,
            heading: blendAngle(
              current.heading,
              measurement.trueHeading,
              0.18,
            ),
            headingAccuracy: measurement.accuracy,
          }));
        },
        (reason) => {
          setState((current) => ({
            ...current,
            error: `Compass update failed: ${reason}`,
            headingAccuracy: 0,
          }));
        },
      );

      DeviceMotion.setUpdateInterval(80);
      motionSubscription.current = DeviceMotion.addListener((measurement) => {
        const gravity = measurement.accelerationIncludingGravity;
        const length = Math.hypot(gravity.x, gravity.y, gravity.z) || 1;
        const altitude =
          (Math.asin(Math.max(-1, Math.min(1, gravity.z / length))) * 180) /
          Math.PI;
        const roll = (Math.atan2(gravity.x, -gravity.y) * 180) / Math.PI;

        setState((current) => ({
          ...current,
          altitude: current.altitude * 0.82 + altitude * 0.18,
          roll: current.roll * 0.82 + roll * 0.18,
        }));
      });
    } catch (error) {
      stop();
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }, [acceptLocation, stop]);

  useEffect(() => stop, [stop]);

  return { ...state, start, stop };
}
