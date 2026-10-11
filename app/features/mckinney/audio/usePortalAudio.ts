import { useEffect, useRef, useState } from "react";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { pausePlayers } from "./safePause";

type Signal = { tuning: number; volume: number } | null;

export function usePortalAudio(signal: Signal, enabled: boolean) {
  const dissonant = useAudioPlayer(
    require("../../../assets/audio/dissonant.wav"),
  );
  const tuned = useAudioPlayer(require("../../../assets/audio/tuned.wav"));
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState("");
  const target = useRef(signal);
  target.current = signal;

  useEffect(() => {
    let cancelled = false;
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "mixWithOthers",
    })
      .then(() => {
        if (!cancelled) setConfigured(true);
      })
      .catch(() => {
        if (!cancelled) setError("Audio unavailable. Reload to retry.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    dissonant.loop = true;
    tuned.loop = true;
    dissonant.volume = 0;
    tuned.volume = 0;
    if (!enabled || !configured) {
      pausePlayers([dissonant, tuned]);
      return;
    }
    // Smooth both layers over time so noisy distance updates do not click.
    let roughVolume = 0;
    let clearVolume = 0;
    const timer = setInterval(() => {
      try {
        const next = target.current;
        const roughTarget = next ? next.volume * (1 - next.tuning) : 0;
        const clearTarget = next ? next.volume * next.tuning : 0;
        roughVolume += (roughTarget - roughVolume) * 0.2;
        clearVolume += (clearTarget - clearVolume) * 0.2;
        dissonant.volume = roughVolume;
        tuned.volume = clearVolume;
        if (next) {
          if (dissonant.isLoaded && !dissonant.playing) dissonant.play();
          if (tuned.isLoaded && !tuned.playing) tuned.play();
        } else if (roughVolume + clearVolume < 0.001) {
          pausePlayers([dissonant, tuned]);
        }
      } catch {
        setError("Audio unavailable. Reload to retry.");
        pausePlayers([dissonant, tuned]);
        clearInterval(timer);
      }
    }, 50);
    return () => {
      clearInterval(timer);
      pausePlayers([dissonant, tuned]);
    };
  }, [enabled, configured, dissonant, tuned]);
  return error;
}
