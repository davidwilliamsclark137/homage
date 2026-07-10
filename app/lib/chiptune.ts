import * as FileSystem from "expo-file-system/legacy";

export type MelodyMood = "bright" | "dreamy" | "arcade";

export type GeneratedMelody = {
  uri: string;
  notes: (number | null)[];
  tempo: number;
  keyName: string;
  mood: MelodyMood;
  seed: number;
};

const SAMPLE_RATE = 22_050;
const STEPS = 16;
const KEY_NAMES: Record<number, string> = {
  48: "C",
  50: "D",
  53: "F",
  55: "G",
  57: "A",
};

const MOOD_SETTINGS: Record<
  MelodyMood,
  { scale: number[]; tempo: [number, number]; duty: number }
> = {
  bright: {
    scale: [0, 2, 4, 5, 7, 9, 11, 12],
    tempo: [124, 148],
    duty: 0.25,
  },
  dreamy: {
    scale: [0, 2, 3, 5, 7, 9, 10, 12],
    tempo: [88, 108],
    duty: 0.5,
  },
  arcade: {
    scale: [0, 3, 5, 6, 7, 10, 12, 15],
    tempo: [142, 172],
    duty: 0.125,
  },
};

export async function generateMelody(
  mood: MelodyMood,
  requestedSeed?: number,
): Promise<GeneratedMelody> {
  if (!FileSystem.cacheDirectory) {
    throw new Error("Audio cache is unavailable.");
  }

  const seed =
    requestedSeed === undefined
      ? (Date.now() ^ Math.floor(Math.random() * 2 ** 31)) >>> 0
      : requestedSeed >>> 0;
  const random = mulberry32(seed);
  const settings = MOOD_SETTINGS[mood];
  const roots = Object.keys(KEY_NAMES).map(Number);
  const root = roots[Math.floor(random() * roots.length)];
  const tempo = Math.round(
    settings.tempo[0] + random() * (settings.tempo[1] - settings.tempo[0]),
  );
  const notes = composeNotes(root, settings.scale, random);
  const bytes = synthesize(notes, root, tempo, settings.duty, random);
  const uri = `${FileSystem.cacheDirectory}homage-chip-${seed}-${Date.now()}.wav`;

  await FileSystem.writeAsStringAsync(uri, bytesToBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });

  return {
    uri,
    notes,
    tempo,
    keyName: KEY_NAMES[root],
    mood,
    seed,
  };
}

function composeNotes(
  root: number,
  scale: number[],
  random: () => number,
): (number | null)[] {
  const motif: (number | null)[] = [];
  let degree = Math.floor(random() * 4);

  for (let step = 0; step < STEPS / 2; step += 1) {
    if (step === 3 && random() < 0.35) {
      motif.push(null);
      continue;
    }
    degree = clamp(degree + choose([-2, -1, 0, 1, 2], random), 0, scale.length - 1);
    motif.push(root + 12 + scale[degree]);
  }

  const variation = motif.map((note, index) => {
    if (note === null) return random() < 0.5 ? root + 12 : null;
    if (index === 7) return root + 12;
    if (random() < 0.28) {
      const currentDegree = scale.findIndex(
        (interval) => root + 12 + interval === note,
      );
      const nextDegree = clamp(
        currentDegree + choose([-1, 1], random),
        0,
        scale.length - 1,
      );
      return root + 12 + scale[nextDegree];
    }
    return note;
  });

  return [...motif, ...variation];
}

function synthesize(
  notes: (number | null)[],
  root: number,
  tempo: number,
  duty: number,
  random: () => number,
) {
  const stepDuration = 30 / tempo;
  const duration = stepDuration * STEPS;
  const sampleCount = Math.ceil(duration * SAMPLE_RATE);
  const pcm = new Int16Array(sampleCount);
  const bassProgression = [0, 0, 5, 5, 7, 7, 0, 0];

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE;
    const step = Math.min(STEPS - 1, Math.floor(time / stepDuration));
    const stepTime = time - step * stepDuration;
    const note = notes[step];
    let sample = 0;

    if (note !== null) {
      const frequency = midiFrequency(note);
      const phase = (time * frequency) % 1;
      const pulse = phase < duty ? 1 : -1;
      const envelope =
        Math.min(1, stepTime / 0.012) *
        Math.min(1, (stepDuration - stepTime) / 0.055);
      sample += pulse * envelope * 0.42;
    }

    const bassOffset = bassProgression[Math.floor(step / 2) % bassProgression.length];
    const bassFrequency = midiFrequency(root - 12 + bassOffset);
    const bassPhase = (time * bassFrequency) % 1;
    const triangle = 1 - 4 * Math.abs(bassPhase - 0.5);
    sample += triangle * 0.2;

    if (step % 2 === 0) {
      const kickEnvelope = Math.exp(-stepTime * 24);
      const kickFrequency = 52 + 58 * Math.exp(-stepTime * 18);
      sample +=
        Math.sin(2 * Math.PI * kickFrequency * stepTime) *
        kickEnvelope *
        0.34;
    } else if (stepTime < 0.045) {
      sample += (random() * 2 - 1) * Math.exp(-stepTime * 75) * 0.1;
    }

    const softened = Math.tanh(sample * 1.15);
    pcm[index] = Math.round(clamp(softened, -1, 1) * 32_767);
  }

  return wavBytes(pcm);
}

function wavBytes(pcm: Int16Array) {
  const bytes = new Uint8Array(44 + pcm.length * 2);
  const view = new DataView(bytes.buffer);

  writeText(bytes, 0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeText(bytes, 8, "WAVE");
  writeText(bytes, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(bytes, 36, "data");
  view.setUint32(40, pcm.length * 2, true);

  for (let index = 0; index < pcm.length; index += 1) {
    view.setInt16(44 + index * 2, pcm[index], true);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array) {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const chunk = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    output += alphabet[(chunk >> 18) & 63];
    output += alphabet[(chunk >> 12) & 63];
    output += second === undefined ? "=" : alphabet[(chunk >> 6) & 63];
    output += third === undefined ? "=" : alphabet[chunk & 63];
  }
  return output;
}

function writeText(bytes: Uint8Array, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index);
  }
}

function midiFrequency(note: number) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function choose<T>(values: T[], random: () => number) {
  return values[Math.floor(random() * values.length)];
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
