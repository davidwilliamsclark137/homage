import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

import { haversine, LatLng } from "../lib/geo";

const MAX_ACCURACY_M = 35;
const MAX_STATIONARY_SPEED_MPS = 1.5;
const MAX_STATIONARY_DRIFT_M = 18;
const REQUIRED_FIXES = 3;
const SAMPLE_INTERVAL_MS = 1_500;

type AcceptedFix = {
  location: LatLng;
  accuracy: number;
};

export function useStationaryAuthoringLocation() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [stationaryFixes, setStationaryFixes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const acceptedRef = useRef<AcceptedFix[]>([]);
  const requestInFlightRef = useRef(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function sample() {
      if (requestInFlightRef.current) return;
      requestInFlightRef.current = true;
      try {
        const next = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (!active) return;
        accept(next);
        setError(null);
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      } finally {
        requestInFlightRef.current = false;
        if (active) setLoading(false);
      }
    }

    function accept(next: Location.LocationObject) {
      setLocation(next);
      const accuracy = next.coords.accuracy;
      const speed = next.coords.speed;
      if (
        accuracy === null ||
        accuracy < 0 ||
        accuracy > MAX_ACCURACY_M ||
        (speed !== null && speed > MAX_STATIONARY_SPEED_MPS)
      ) {
        acceptedRef.current = [];
        setStationaryFixes(0);
        return;
      }

      const fix: AcceptedFix = {
        location: {
          latitude: next.coords.latitude,
          longitude: next.coords.longitude,
        },
        accuracy,
      };
      const previous = acceptedRef.current[acceptedRef.current.length - 1];
      if (
        previous &&
        haversine(previous.location, fix.location) > MAX_STATIONARY_DRIFT_M
      ) {
        acceptedRef.current = [fix];
      } else {
        acceptedRef.current = [...acceptedRef.current, fix].slice(
          -REQUIRED_FIXES,
        );
      }
      setStationaryFixes(acceptedRef.current.length);
    }

    async function start() {
      try {
        if (!(await Location.hasServicesEnabledAsync())) {
          throw new Error("Location Services are disabled.");
        }
        const permission =
          await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          throw new Error("Precise location permission is required.");
        }
        await sample();
        if (active) {
          timer = setInterval(() => void sample(), SAMPLE_INTERVAL_MS);
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : String(caught));
          setLoading(false);
        }
      }
    }

    void start();
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  const accuracy = location?.coords.accuracy ?? null;
  const gpsReady =
    accuracy !== null &&
    accuracy <= MAX_ACCURACY_M &&
    stationaryFixes >= REQUIRED_FIXES;
  const status =
    accuracy === null
      ? "Waiting for GPS"
      : accuracy > MAX_ACCURACY_M
        ? `GPS accuracy +/-${Math.round(accuracy)} m`
        : `Stationary GPS ${Math.min(stationaryFixes, REQUIRED_FIXES)}/${REQUIRED_FIXES}`;

  return {
    accuracy,
    error,
    gpsReady,
    loading,
    location,
    stationaryFixes,
    status,
  };
}
