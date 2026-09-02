import * as FileSystem from "expo-file-system/legacy";

const SAMPLE_RATE = 22_050;
const DURATION = 1.15;
const cache = new Map<string, string>();

// errorStep runs from -10 to 10. Zero produces a pure 1 : 5/4 : 3/2 chord.
export async function tuningTone(node: number, errorStep: number) {
  const step = Math.max(-10, Math.min(10, Math.round(errorStep)));
  const key = `${node}-${step}`;
  const existing = cache.get(key);
  if (existing) return existing;
  if (!FileSystem.cacheDirectory) throw new Error("Audio cache unavailable");
  const root = 220 * Math.pow(2, (node % 9) / 24);
  const ratios = [1, 5 / 4, 3 / 2];
  const detuneShape = [92, -126, 71];
  const count = Math.floor(SAMPLE_RATE * DURATION);
  const pcm = new Int16Array(count);
  for (let i = 0; i < count; i++) {
    const time = i / SAMPLE_RATE;
    const edge = Math.min(1, time / 0.025, (DURATION - time) / 0.025);
    let sample = 0;
    for (let voice = 0; voice < 3; voice++) {
      const cents = detuneShape[voice] * (step / 10);
      const frequency = root * ratios[voice] * Math.pow(2, cents / 1200);
      sample += Math.sin(Math.PI * 2 * frequency * time) * 0.2;
      sample += Math.sin(Math.PI * 2 * frequency * 2 * time) * 0.025;
    }
    pcm[i] = Math.round(Math.tanh(sample * edge * (step === 0 ? 0.95 : 0.76)) * 32767);
  }
  const uri = `${FileSystem.cacheDirectory}homage-tuning-${key}.wav`;
  await FileSystem.writeAsStringAsync(uri, base64(wav(pcm)), { encoding: FileSystem.EncodingType.Base64 });
  cache.set(key, uri);
  return uri;
}

function wav(pcm: Int16Array) { const bytes = new Uint8Array(44 + pcm.length * 2), v = new DataView(bytes.buffer); text(bytes, 0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); text(bytes, 8, "WAVE"); text(bytes, 12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, SAMPLE_RATE, true); v.setUint32(28, SAMPLE_RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); text(bytes, 36, "data"); v.setUint32(40, pcm.length * 2, true); for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, pcm[i], true); return bytes; }
function text(bytes: Uint8Array, at: number, value:string) { for (let i = 0; i < value.length; i++) bytes[at + i] = value.charCodeAt(i); }
function base64(bytes: Uint8Array) { const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"; let out = ""; for (let i = 0; i < bytes.length; i += 3) { const a=bytes[i],b=bytes[i+1],c=bytes[i+2],n=(a<<16)|((b??0)<<8)|(c??0); out+=chars[(n>>18)&63]+chars[(n>>12)&63]+(b===undefined?"=":chars[(n>>6)&63])+(c===undefined?"=":chars[n&63]); } return out; }
