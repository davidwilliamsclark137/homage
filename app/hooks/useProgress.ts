import { sendProgress } from "../lib/api";
import { useQuestStore } from "../state/quests";

type Args = { questId: string; playerId: string; stepIndex: number; completed: boolean };

export async function submitProgress({ questId, playerId, stepIndex, completed }: Args) {
  const quest = useQuestStore.getState().byId[questId];
  return sendProgress(questId, {
    player_id: playerId,
    step_index: stepIndex,
    completed,
    quest_version: quest?.version ?? 0,
  });
}

