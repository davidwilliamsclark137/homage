import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Quest = {
  id: string;
  title: string;
  description: string;
  status: "active" | "disabled";
  steps?: Record<string, any> | string;
  version: number;
  updated_at: string; // ISO
};

type QuestState = {
  byId: Record<string, Quest>;
  lastSync: string | null;
  upsertMany: (qs: Quest[]) => void;
  setLastSync: (iso: string) => void;
  clearAll: () => void;
};

export const useQuestStore = create<QuestState>()(
  persist(
    (set, get) => ({
      byId: {},
      lastSync: null,
      upsertMany: (qs) =>
        set((s) => {
          const next = { ...s.byId };
          for (const q of qs) {
            const prev = next[q.id];
            // prefer whichever has newer updated_at
            if (!prev || new Date(q.updated_at) > new Date(prev.updated_at)) {
              next[q.id] = q;
            }
          }
          return { byId: next };
        }),
      setLastSync: (iso) => set({ lastSync: iso }),
      clearAll: () => set({ byId: {}, lastSync: null }),
    }),
    { name: "quests-v1" }
  )
);

