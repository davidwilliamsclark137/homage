import * as FileSystem from "expo-file-system/legacy";

export type ChipKey = "C" | "D" | "E" | "F" | "G" | "A";
export type ChipScale = "major" | "minor";
export type ChipMeter = "4/4" | "3/4" | "6/8";
export type DrumVoice = "kick" | "snare" | "hat";
export type ChordQuality =
  | "triad"
  | "maj7"
  | "min7"
  | "dom7"
  | "half-dim"
  | "dim7";
export type ChordExtension =
  | "9"
  | "b9"
  | "#9"
  | "11"
  | "#11"
  | "13"
  | "b13";

export type ChordVoicing = {
  quality: ChordQuality;
  extensions: ChordExtension[];
};

export type ChipSong = {
  version: 1;
  title: string;
  key: ChipKey;
  scale: ChipScale;
  meter: ChipMeter;
  tempo: number;
  chordDegrees: number[];
  chordVoicings?: ChordVoicing[];
  melody: (number | null)[][];
  drums: Record<DrumVoice, boolean[][]>;
};

const SAMPLE_RATE = 22_050;
const BARS = 8;
const KEY_MIDI: Record<ChipKey, number> = {
  C: 48,
  D: 50,
  E: 52,
  F: 53,
  G: 55,
  A: 57,
};
const SCALES: Record<ChipScale, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11, 12],
  minor: [0, 2, 3, 5, 7, 8, 10, 12],
};
export const CHORD_QUALITIES: ChordQuality[] = [
  "triad",
  "maj7",
  "min7",
  "dom7",
  "half-dim",
  "dim7",
];
export const CHORD_EXTENSIONS: ChordExtension[] = [
  "9",
  "b9",
  "#9",
  "11",
  "#11",
  "13",
  "b13",
];

export function stepsPerBar(meter: ChipMeter) {
  return meter === "4/4" ? 8 : 6;
}

export function createChipSong(
  meter: ChipMeter = "4/4",
  random: () => number = Math.random,
): ChipSong {
  const steps = stepsPerBar(meter);
  const chordDegrees = [0, 3, 4, 0, 5, 3, 4, 0];
  const chordVoicings = Array.from({ length: BARS }, defaultChordVoicing);
  const melody = Array.from({ length: BARS }, (_, bar) =>
    Array.from({ length: steps }, (_, step) => {
      if (random() < 0.32) return null;
      const chord = chordDegrees[bar];
      const tones = [chord, chord + 2, chord + 4, 7];
      return tones[(step + Math.floor(random() * tones.length)) % tones.length] % 8;
    }),
  );
  const drums = {
    kick: Array.from({ length: BARS }, () =>
      Array.from({ length: steps }, (_, step) => step === 0 || step === 4),
    ),
    snare: Array.from({ length: BARS }, () =>
      Array.from({ length: steps }, (_, step) =>
        meter === "4/4" ? step === 2 || step === 6 : step === 3,
      ),
    ),
    hat: Array.from({ length: BARS }, () =>
      Array.from({ length: steps }, (_, step) => step % 2 === 0),
    ),
  };

  return {
    version: 1,
    title: "Untitled cartridge",
    key: "C",
    scale: "major",
    meter,
    tempo: 120,
    chordDegrees,
    chordVoicings,
    melody,
    drums,
  };
}

export function resizeChipSong(song: ChipSong, meter: ChipMeter): ChipSong {
  const nextSteps = stepsPerBar(meter);
  const resize = <T>(values: T[], fallback: T) =>
    Array.from({ length: nextSteps }, (_, index) => values[index] ?? fallback);
  return {
    ...song,
    meter,
    melody: song.melody.map((bar) => resize<number | null>(bar, null)),
    drums: {
      kick: song.drums.kick.map((bar) => resize(bar, false)),
      snare: song.drums.snare.map((bar) => resize(bar, false)),
      hat: song.drums.hat.map((bar) => resize(bar, false)),
    },
  };
}

export function randomizeChipSong(song: ChipSong): ChipSong {
  const randomized = createChipSong(song.meter);
  return {
    ...randomized,
    title: song.title,
    key: song.key,
    scale: song.scale,
    tempo: song.tempo,
  };
}

export function chordName(
  song: ChipSong,
  degree: number,
  voicing: ChordVoicing = defaultChordVoicing(),
) {
  const scale = SCALES[song.scale];
  const noteNames = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  const root = KEY_MIDI[song.key] + scale[degree % 7];
  return `${noteNames[root % 12]}${chordSuffix(voicing)}`;
}

export function chordNameForBar(song: ChipSong, bar: number) {
  const degree = song.chordDegrees[bar] ?? 0;
  const scale = SCALES[song.scale];
  const noteNames = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  const root = KEY_MIDI[song.key] + scale[degree % 7];
  return `${noteNames[root % 12]}${chordSuffix(chordVoicingFor(song, bar))}`;
}

export function chordVoicingFor(song: ChipSong, bar: number): ChordVoicing {
  return normalizeChordVoicing(song.chordVoicings?.[bar]);
}

export function melodyNoteName(song: ChipSong, degree: number) {
  const midi = KEY_MIDI[song.key] + 12 + SCALES[song.scale][degree];
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return names[midi % 12];
}

export async function renderChipSong(song: ChipSong): Promise<string> {
  if (!FileSystem.cacheDirectory) {
    throw new Error("Audio cache is unavailable.");
  }
  validateChipSong(song);
  const bytes = synthesize(song);
  const uri = `${FileSystem.cacheDirectory}homage-song-${Date.now()}.wav`;
  await FileSystem.writeAsStringAsync(uri, bytesToBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}

export function validateChipSong(song: ChipSong) {
  const steps = stepsPerBar(song.meter);
  if (
    song.version !== 1 ||
    !KEY_MIDI[song.key] ||
    !SCALES[song.scale] ||
    !Number.isFinite(song.tempo) ||
    song.tempo < 60 ||
    song.tempo > 180 ||
    song.chordDegrees.length !== BARS ||
    song.melody.length !== BARS ||
    Object.values(song.drums).some((track) => track.length !== BARS) ||
    song.melody.some(
      (bar) =>
        bar.length !== steps ||
        bar.some(
          (note) =>
            note !== null &&
            (!Number.isInteger(note) || note < 0 || note > 7),
        ),
    ) ||
    Object.values(song.drums).some((track) =>
      track.some(
        (bar) =>
          bar.length !== steps || bar.some((hit) => typeof hit !== "boolean"),
      ),
    ) ||
    song.chordDegrees.some(
      (degree) => !Number.isInteger(degree) || degree < 0 || degree > 6,
    ) ||
    (song.chordVoicings !== undefined &&
      (song.chordVoicings.length !== BARS ||
        song.chordVoicings.some((voicing) => !isValidChordVoicing(voicing))))
  ) {
    throw new Error("This 8-bit song has an invalid sequence.");
  }
}

function synthesize(song: ChipSong) {
  const steps = stepsPerBar(song.meter);
  const totalSteps = BARS * steps;
  const stepDuration = 30 / song.tempo;
  const sampleCount = Math.ceil(totalSteps * stepDuration * SAMPLE_RATE);
  const pcm = new Int16Array(sampleCount);
  const scale = SCALES[song.scale];
  const root = KEY_MIDI[song.key];

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE;
    const absoluteStep = Math.min(
      totalSteps - 1,
      Math.floor(time / stepDuration),
    );
    const bar = Math.floor(absoluteStep / steps);
    const step = absoluteStep % steps;
    const stepTime = time - absoluteStep * stepDuration;
    const noteDegree = song.melody[bar][step];
    let sample = 0;

    if (noteDegree !== null) {
      const frequency = midiFrequency(root + 12 + scale[noteDegree]);
      const envelope = chipEnvelope(stepTime, stepDuration, 0.018, 0.055);
      sample += pulse(time, frequency, 0.25) * envelope * 0.34;
    }

    const chordDegree = song.chordDegrees[bar];
    const chord = chordIntervals(song.scale, chordDegree, chordVoicingFor(song, bar));
    const arpTone =
      chord[Math.floor(stepTime / Math.max(0.06, stepDuration / 3)) % chord.length];
    const chordMidi = root + scale[chordDegree] + arpTone;
    sample += pulse(time, midiFrequency(chordMidi), 0.125) * 0.1;

    const bassPhase = (time * midiFrequency(root - 12 + scale[chordDegree])) % 1;
    sample += (1 - 4 * Math.abs(bassPhase - 0.5)) * 0.13;

    if (song.drums.kick[bar][step]) {
      const envelope = Math.exp(-stepTime * 22);
      const frequency = 48 + 70 * Math.exp(-stepTime * 20);
      sample += Math.sin(2 * Math.PI * frequency * stepTime) * envelope * 0.38;
    }
    if (song.drums.snare[bar][step] && stepTime < 0.12) {
      sample += deterministicNoise(index) * Math.exp(-stepTime * 28) * 0.22;
    }
    if (song.drums.hat[bar][step] && stepTime < 0.04) {
      const noise = deterministicNoise(index * 17);
      sample += Math.sign(noise) * Math.exp(-stepTime * 85) * 0.09;
    }

    pcm[index] = Math.round(clamp(Math.tanh(sample * 1.2), -1, 1) * 32_767);
  }
  return wavBytes(pcm);
}

function chordIntervals(
  scale: ChipScale,
  degree: number,
  voicing: ChordVoicing = defaultChordVoicing(),
) {
  if (voicing.quality !== "triad") {
    const base: Record<Exclude<ChordQuality, "triad">, number[]> = {
      maj7: [0, 4, 7, 11],
      min7: [0, 3, 7, 10],
      dom7: [0, 4, 7, 10],
      "half-dim": [0, 3, 6, 10],
      dim7: [0, 3, 6, 9],
    };
    return [...base[voicing.quality], ...voicing.extensions.map(extensionInterval)];
  }

  const values = SCALES[scale];
  const root = values[degree];
  const triad = [0, 2, 4].map((offset) => {
    const target = degree + offset;
    return values[target % 7] + (target >= 7 ? 12 : 0) - root;
  });
  return [...triad, ...voicing.extensions.map(extensionInterval)];
}

function defaultChordVoicing(): ChordVoicing {
  return { quality: "triad", extensions: [] };
}

function normalizeChordVoicing(voicing: ChordVoicing | undefined): ChordVoicing {
  if (!isValidChordVoicing(voicing)) return defaultChordVoicing();
  return {
    quality: voicing.quality,
    extensions: [...new Set(voicing.extensions)],
  };
}

function isValidChordVoicing(voicing: unknown): voicing is ChordVoicing {
  if (!voicing || typeof voicing !== "object") return false;
  const candidate = voicing as ChordVoicing;
  return (
    CHORD_QUALITIES.includes(candidate.quality) &&
    Array.isArray(candidate.extensions) &&
    candidate.extensions.every((extension) => CHORD_EXTENSIONS.includes(extension))
  );
}

function chordSuffix(voicing: ChordVoicing) {
  const qualityLabel: Record<ChordQuality, string> = {
    triad: "",
    maj7: "maj7",
    min7: "m7",
    dom7: "7",
    "half-dim": "m7b5",
    dim7: "dim7",
  };
  return `${qualityLabel[voicing.quality]}${voicing.extensions.join("")}`;
}

function extensionInterval(extension: ChordExtension) {
  const intervals: Record<ChordExtension, number> = {
    b9: 13,
    "9": 14,
    "#9": 15,
    "11": 17,
    "#11": 18,
    b13: 20,
    "13": 21,
  };
  return intervals[extension];
}

function chipEnvelope(
  time: number,
  duration: number,
  attack: number,
  release: number,
) {
  return (
    Math.min(1, time / attack) *
    Math.min(1, Math.max(0, duration - time) / release)
  );
}

function pulse(time: number, frequency: number, duty: number) {
  return (time * frequency) % 1 < duty ? 1 : -1;
}

function deterministicNoise(index: number) {
  const value = Math.sin(index * 12.9898) * 43_758.5453;
  return (value - Math.floor(value)) * 2 - 1;
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

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
