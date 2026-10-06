import 'react-native-get-random-values';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
export type Encounter = {
  eventId: string; constellation: string; mode: 'test' | 'field'; role: 'amber' | 'teal'; progress: number; peerProgress: number;
  phase: 'waiting' | 'paired' | 'solo' | 'complete' | 'left'; peerOnline: boolean; peerLeft: boolean;
  canSolo: boolean; soloWaitMs: number; canCollect: boolean; consent: boolean; peerAtFinal: boolean;
  ending: 'shared' | 'solo' | null; expiresAt: number;
};
export type Credential = { key: string; constellation: string; scannedAt: number; mode: 'test' | 'field' };
export const credentialKey = (mode: string) => 'homage.night.credential.v1.' + mode;
export async function createCredential(mode: 'test' | 'field', constellation: string, scannedAt: number): Promise<Credential> {
  const bytes = new Uint8Array(24); crypto.getRandomValues(bytes);
  const value = { key: Array.from(bytes,b => b.toString(16).padStart(2,'0')).join(''), constellation, scannedAt, mode };
  await AsyncStorage.setItem(credentialKey(mode),JSON.stringify(value));
  return value;
}
export async function encounterRequest(credential: Credential, action: string, values: Record<string,unknown> = {}): Promise<Encounter> {
  const host = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  if (Platform.OS !== 'web' && (!__DEV__ || !host)) throw Error('Open this prototype using the live Expo Go link.');
  const base = Platform.OS === 'web' ? window.location.origin : (host!.includes('exp.direct') || host!.includes('ngrok') ? 'https://' : 'http://') + host;
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(),6000);
  try {
    const response = await fetch(base + '/homage-encounter', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ ...credential, ...values, action }), signal: controller.signal });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || 'Connection interrupted.'),{ status: response.status });
    return data;
  } finally { clearTimeout(timeout); }
}
