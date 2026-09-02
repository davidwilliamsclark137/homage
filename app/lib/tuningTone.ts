import * as FileSystem from "expo-file-system/legacy";

const SAMPLE_RATE = 22_050;
const DURATION = 4;
const cache = new Map<string, string>();

/** Creates one seamless oscillator. Its pitch is changed live by the native player. */
export async function tuningVoice(node: number, voice: number) {
  const key = `${node}-${voice}`;
  const existing = cache.get(key);
  if (existing) return existing;
  if (!FileSystem.cacheDirectory) throw new Error("Audio cache unavailable");

  const ratios = [1, 5 / 4, 3 / 2];
  const requested = 220 * Math.pow(2, (node % 9) / 24) * ratios[voice];
  // An integer cycle count makes the WAV loop without a click at its seam.
  const frequency = Math.round(requested * DURATION) / DURATION;
  const count = SAMPLE_RATE * DURATION;
  const pcm = new Int16Array(count);
  for (let i = 0; i < count; i++) {
    const time = i / SAMPLE_RATE;
    const sample = Math.sin(Math.PI * 2 * frequency * time) * 0.72
      + Math.sin(Math.PI * 2 * frequency * 2 * time) * 0.08;
    pcm[i] = Math.round(Math.tanh(sample) * 32767);
  }

  const uri = `${FileSystem.cacheDirectory}homage-voice-${key}.wav`;
  await FileSystem.writeAsStringAsync(uri, base64(wav(pcm)), { encoding: FileSystem.EncodingType.Base64 });
  cache.set(key, uri);
  return uri;
}

function wav(pcm: Int16Array) { const bytes = new Uint8Array(44 + pcm.length * 2), v = new DataView(bytes.buffer); text(bytes, 0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); text(bytes, 8, "WAVE"); text(bytes, 12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, SAMPLE_RATE, true); v.setUint32(28, SAMPLE_RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); text(bytes, 36, "data"); v.setUint32(40, pcm.length * 2, true); for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, pcm[i], true); return bytes; }
function text(bytes: Uint8Array, at: number, value: string) { for (let i = 0; i < value.length; i++) bytes[at + i] = value.charCodeAt(i); }
function base64(bytes: Uint8Array) { const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"; let out = ""; for (let i = 0; i < bytes.length; i += 3) { const a=bytes[i],b=bytes[i+1],c=bytes[i+2],n=(a<<16)|((b??0)<<8)|(c??0); out+=chars[(n>>18)&63]+chars[(n>>12)&63]+(b===undefined?"=":chars[(n>>6)&63])+(c===undefined?"=":chars[n&63]); } return out; }
