import * as FileSystem from "expo-file-system/legacy";

const SAMPLE_RATE = 22_050;
const DURATION = 12;
const cache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

/** Builds a long, seamless mixed chord. The UI morphs by crossfading two layers. */
export function tuningLayer(node: number, pure: boolean) {
  const key = `${node}-${pure ? "pure-v2" : "drift-v2"}`;
  const existing = cache.get(key);
  if (existing) return Promise.resolve(existing);
  const pending = inFlight.get(key);
  if (pending) return pending;
  const task = buildLayer(node, pure, key).finally(() => inFlight.delete(key));
  inFlight.set(key, task);
  return task;
}

async function buildLayer(node: number, pure: boolean, key: string) {
  if (!FileSystem.cacheDirectory) throw new Error("Audio cache unavailable");
  const uri = `${FileSystem.cacheDirectory}homage-${key}.wav`;
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) { cache.set(key, uri); return uri; }

  const requestedRoot = 220 * Math.pow(2, (node % 9) / 24);
  const rootCycles = Math.max(4, Math.round(requestedRoot * DURATION / 4) * 4);
  const root = rootCycles / DURATION;
  const ratios = [1, 5 / 4, 3 / 2];
  const detunes = pure ? [0, 0, 0] : [92, -126, 71];
  const harmonics = [0.17, 0.058, 0.032, 0.022, 0.016];
  const frequencies = ratios.map((ratio, voice) => {
    const requested = root * ratio * Math.pow(2, detunes[voice] / 1200);
    return Math.round(requested * DURATION) / DURATION;
  });
  const oscillators = frequencies.flatMap(frequency => harmonics.map((amplitude, index) => {
    const step = Math.PI * 2 * frequency * (index + 1) / SAMPLE_RATE;
    return { amplitude, sin: 0, cos: 1, sinStep: Math.sin(step), cosStep: Math.cos(step) };
  }));
  const count = SAMPLE_RATE * DURATION;
  const pcm = new Int16Array(count);
  for (let i = 0; i < count; i++) {
    let sample = 0;
    for (const oscillator of oscillators) {
      sample += oscillator.sin * oscillator.amplitude;
      const nextSin = oscillator.sin * oscillator.cosStep + oscillator.cos * oscillator.sinStep;
      oscillator.cos = oscillator.cos * oscillator.cosStep - oscillator.sin * oscillator.sinStep;
      oscillator.sin = nextSin;
    }
    pcm[i] = Math.round(Math.tanh(sample) * 32767);
  }
  await FileSystem.writeAsStringAsync(uri, base64(wav(pcm)), { encoding: FileSystem.EncodingType.Base64 });
  cache.set(key, uri);
  return uri;
}

function wav(pcm: Int16Array) { const bytes = new Uint8Array(44 + pcm.length * 2), v = new DataView(bytes.buffer); text(bytes, 0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); text(bytes, 8, "WAVE"); text(bytes, 12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, SAMPLE_RATE, true); v.setUint32(28, SAMPLE_RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); text(bytes, 36, "data"); v.setUint32(40, pcm.length * 2, true); for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, pcm[i], true); return bytes; }
function text(bytes: Uint8Array, at: number, value: string) { for (let i = 0; i < value.length; i++) bytes[at + i] = value.charCodeAt(i); }
function base64(bytes: Uint8Array) { const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"; let out = ""; for (let i = 0; i < bytes.length; i += 3) { const a=bytes[i],b=bytes[i+1],c=bytes[i+2],n=(a<<16)|((b??0)<<8)|(c??0); out+=chars[(n>>18)&63]+chars[(n>>12)&63]+(b===undefined?"=":chars[(n>>6)&63])+(c===undefined?"=":chars[n&63]); } return out; }
