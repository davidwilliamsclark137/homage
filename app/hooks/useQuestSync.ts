import { useCallback, useEffect, useRef } from "react";
import { useQuestStore } from "../state/quests";
import { fetchQuestsSince } from "../lib/api";

export function useQuestSync() {
  const { lastSync, setLastSync, upsertMany } = useQuestStore();
  const inFlight = useRef(false);

  const runDelta = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const changes = await fetchQuestsSince(lastSync ?? undefined);
      if (changes.length) upsertMany(changes);
      setLastSync(new Date().toISOString());
    } finally {
      inFlight.current = false;
    }
  }, [lastSync, setLastSync, upsertMany]);

  useEffect(() => {
    runDelta().catch(console.warn);
  }, [runDelta]);

  return { refetchDelta: runDelta };
}

