import Constants from 'expo-constants';
import { Platform } from 'react-native';
export type Signal = { token: string; fragment: 'amber' | 'teal'; phase: 'waiting' | 'resonating' | 'revealed'; remainingMs: number };
function relayUrl() {
  if (Platform.OS === 'web') return window.location.origin + '/homage-signal';
  const host = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  if (!__DEV__ || !host) throw Error('This test needs the live Expo development server.');
  return (host.includes('exp.direct') || host.includes('ngrok') ? 'https://' : 'http://') + host + '/homage-signal';
}
export async function signalRequest(body: { action: 'join'; room: string; device: string } | { action: 'pulse' | 'leave'; token: string }): Promise<Signal> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(relayUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    if (!response.ok) throw Error(response.status === 410 ? 'Your signal paused. Join again when you’re ready.' : 'The shared signal is unavailable. Check your connection and try again.');
    return await response.json();
  } finally { clearTimeout(timeout); }
}
