import AsyncStorage from "@react-native-async-storage/async-storage";
import { createPlacedDocumentId } from "./placedDocumentEncryption";

const KEY = "homage.two-player-id.v1";

export async function getTwoPlayerId() {
  const existing = await AsyncStorage.getItem(KEY).catch(() => null);
  if (existing) return existing;
  const id = createPlacedDocumentId().replace("placed-", "player-");
  await AsyncStorage.setItem(KEY, id);
  return id;
}
