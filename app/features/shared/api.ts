import Constants from "expo-constants";
import { Platform } from "react-native";
export type SharedWalk = {
  code: string;
  mode: "walk" | "rehearsal";
  expiresAt: number;
  role: "landon" | "patina";
  fragment: number | null;
  arrived: boolean;
  meet: boolean;
  again: boolean;
  complete: boolean;
  meeting: boolean;
  reconnect: boolean;
  other: { fragment: number | null; online: boolean } | null;
};
export type Session = {
  token: string;
  mode: "walk" | "rehearsal";
  code?: string;
};
export async function request(
  session: Session,
  action: string,
  data = {},
): Promise<SharedWalk> {
  const host = Constants.expoConfig?.hostUri;
  const origin =
    Platform.OS === "web"
      ? window.location.origin
      : host
        ? `${host.endsWith(".exp.direct") ? "https" : "http"}://${host}`
        : null;
  if (!origin) throw Error("Open this prototype through its Expo Go link.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${origin}/homage-social/v1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...session, action, ...data }),
      signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || "Shared walk unavailable.");
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw Error(
        "Connection timed out. Your last saved step is safe; try again.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
