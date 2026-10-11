import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { Accelerometer, DeviceMotion, Magnetometer } from 'expo-sensors';

import {
  normalizeDegrees,
  cameraDirection,
  normalizeGravity,
  plausibleGravity,
  plausibleMagneticField,
  advancingSample,
  type Observer,
} from '@mckinney/star-engine';

type SkyPoseState = {
  observer: Observer | null;
  heading: number;
  altitude: number;
  roll: number;
  qualityTimestamp: number | null;
  declination: number | null;
  gravityNorm: number | null;
  magneticNorm: number | null;
  headingAccuracy: number;
  headingTimestamp: number | null;
  motionTimestamp: number | null;
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
  qualityTimestamp: null,
  declination: null,
  gravityNorm: null,
  magneticNorm: null,
  headingAccuracy: 0,
  headingTimestamp: null,
  motionTimestamp: null,
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
  const generation = useRef(0);
  const nativeMotionTime = useRef<number | null>(null);
  const nativeMagneticTime = useRef<number | null>(null);
  const northCorrection = useRef<number | null>(null);
  const magnetic = useRef<{ x: number; y: number; z: number; received: number } | null>(
    null,
  );
  const magneticSubscription = useRef<{ remove: () => void } | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const headingSubscription = useRef<Location.LocationSubscription | null>(null);
  const motionSubscription = useRef<{ remove: () => void } | null>(null);

  const acceptLocation = useCallback((location: Location.LocationObject) => {
    const accuracy = location.coords.accuracy;
    if (accuracy === null || !Number.isFinite(accuracy) || accuracy < 0) return;

    const observer = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      elevationMeters: location.coords.altitude ?? undefined,
    };
    const age = Date.now() - location.timestamp;
    const fresh = age >= 0 && age < 10_000;

    setState((current) => {
      const qualityFix = fresh && accuracy <= 35;

      return {
        ...current,
        observer,
        locationAccuracy: accuracy,
        locationTimestamp: location.timestamp,
        locationFixCount: qualityFix ? Math.min(3, current.locationFixCount + 1) : 0,
      };
    });
  }, []);

  const stop = useCallback(() => {
    generation.current++;
    northCorrection.current = null;
    nativeMotionTime.current = null;
    nativeMagneticTime.current = null;
    magnetic.current = null;
    magneticSubscription.current?.remove();
    magneticSubscription.current = null;
    locationSubscription.current?.remove();
    headingSubscription.current?.remove();
    motionSubscription.current?.remove();
    locationSubscription.current = null;
    headingSubscription.current = null;
    motionSubscription.current = null;
    setState(initialState);
  }, []);

  const start = useCallback(async () => {
    stop();
    const run = generation.current;
    const current = () => run === generation.current;
    setState((current) => ({ ...current, error: null }));

    try {
      const motionAvailable = await (Platform.OS === 'android'
        ? Accelerometer.isAvailableAsync()
        : DeviceMotion.isAvailableAsync());
      if (!current()) return;
      if (!(await Magnetometer.isAvailableAsync()))
        throw new Error('A magnetometer is required for sky alignment.');
      if (!current()) return;
      if (!motionAvailable) {
        throw new Error('Device motion is not available on this phone.');
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        throw new Error('Location Services are disabled on this phone.');
      }
      if (Platform.OS === 'android') {
        await Location.enableNetworkProviderAsync().catch(() => {});
      }

      const locationPermission = await Location.requestForegroundPermissionsAsync();
      if (!current()) return;
      if (locationPermission.status !== 'granted') {
        throw new Error(
          'Location permission is required. In Expo Go’s app permissions, allow Location while using the app and enable precise location. Then restart sky sensors.',
        );
      }
      // Android tilt only needs accelerometer data, not activity recognition.
      // GrapheneOS still controls this stream through its Sensors permission.
      if (Platform.OS !== 'android') {
        const motionPermission = await DeviceMotion.requestPermissionsAsync();
        if (!current()) return;
        if (motionPermission.status !== 'granted') {
          throw new Error(
            'Motion permission is required. Allow Motion & Fitness for Expo Go in Settings, then restart sky sensors.',
          );
        }
      }

      if (!current()) return;
      const firstLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      if (!current()) return;
      acceptLocation(firstLocation);
      setState((current) => ({
        ...current,
        motionAvailable,
        running: true,
      }));

      const locationWatcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          distanceInterval: 0,
          timeInterval: 1_000,
        },
        (value) => {
          if (current()) acceptLocation(value);
        },
        (reason) => {
          if (!current()) return;
          setState((current) => ({
            ...current,
            error: `Location update failed: ${reason}`,
            locationFixCount: 0,
          }));
        },
      );

      if (!current()) {
        locationWatcher.remove();
        return;
      }
      locationSubscription.current = locationWatcher;
      const headingWatcher = await Location.watchHeadingAsync(
        (measurement) => {
          if (!current()) return;
          if (
            measurement.trueHeading < 0 ||
            measurement.magHeading < 0 ||
            !Number.isFinite(measurement.trueHeading) ||
            !Number.isFinite(measurement.magHeading)
          ) {
            northCorrection.current = null;
            setState((current) => ({
              ...current,
              qualityTimestamp: null,
              headingAccuracy: 0,
            }));
            return;
          }
          northCorrection.current =
            ((measurement.trueHeading - measurement.magHeading + 540) % 360) - 180;
          setState((current) => ({
            ...current,
            headingAccuracy: measurement.accuracy,
            qualityTimestamp: Date.now(),
            declination: northCorrection.current,
          }));
        },
        (reason) => {
          if (!current()) return;
          setState((current) => ({
            ...current,
            error: `Compass update failed: ${reason}`,
            headingAccuracy: 0,
          }));
        },
      );

      if (!current()) {
        headingWatcher.remove();
        return;
      }
      headingSubscription.current = headingWatcher;
      const acceptGravity = (
        gravity: { x: number; y: number; z: number },
        timestamp: number,
      ) => {
        if (!current()) return;
        const invalidate = () =>
          setState((previous) => ({
            ...previous,
            motionTimestamp: null,
            headingTimestamp: null,
          }));
        if (!advancingSample(nativeMotionTime.current, timestamp)) {
          invalidate();
          return;
        }
        nativeMotionTime.current = timestamp;
        if (!plausibleGravity(gravity)) {
          invalidate();
          return;
        }
        const field = magnetic.current;
        if (
          !field ||
          Date.now() - field.received > 1000 ||
          northCorrection.current === null
        ) {
          invalidate();
          return;
        }
        const direction = cameraDirection(gravity, field, northCorrection.current);
        if (!direction) {
          invalidate();
          return;
        }
        const received = Date.now();
        setState((previous) => ({
          ...previous,
          gravityNorm: Math.hypot(gravity.x, gravity.y, gravity.z),
          magneticNorm: Math.hypot(field.x, field.y, field.z),
          motionTimestamp: received,
          headingTimestamp: field.received,
          heading:
            previous.headingTimestamp === null
              ? direction.heading
              : blendAngle(previous.heading, direction.heading, 0.35),
          altitude:
            previous.motionTimestamp === null
              ? direction.altitude
              : previous.altitude * 0.65 + direction.altitude * 0.35,
          roll:
            previous.motionTimestamp === null
              ? direction.roll
              : previous.roll +
                (((direction.roll - previous.roll + 540) % 360) - 180) * 0.35,
        }));
      };
      Magnetometer.setUpdateInterval(80);
      magneticSubscription.current = Magnetometer.addListener((value) => {
        if (!current()) return;
        if (
          !advancingSample(nativeMagneticTime.current, value.timestamp) ||
          !plausibleMagneticField(value)
        ) {
          magnetic.current = null;
          setState((previous) => ({ ...previous, headingTimestamp: null }));
          return;
        }
        nativeMagneticTime.current = value.timestamp;
        magnetic.current = { ...value, received: Date.now() };
      });
      if (Platform.OS === 'android') {
        Accelerometer.setUpdateInterval(80);
        motionSubscription.current = Accelerometer.addListener(
          ({ x, y, z, timestamp }) => {
            // Android's accelerometer reports support force; negate it to match
            // the gravity direction used by DeviceMotion when the phone is steady.
            acceptGravity(normalizeGravity('android', { x, y, z }), timestamp);
          },
        );
      } else {
        DeviceMotion.setUpdateInterval(80);
        motionSubscription.current = DeviceMotion.addListener((measurement) => {
          acceptGravity(
            normalizeGravity(
              'ios',
              measurement.accelerationIncludingGravity,
              measurement.acceleration,
            ),
            measurement.accelerationIncludingGravity.timestamp,
          );
        });
      }
    } catch (error) {
      if (!current()) return;
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
