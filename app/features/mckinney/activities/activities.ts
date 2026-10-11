export type ActivityKind =
  | "blend"
  | "slice"
  | "notice"
  | "memory"
  | "weave"
  | "rhythm"
  | "performance"
  | "hold";
export const ACTIVITIES: Record<
  string,
  { kind: ActivityKind; title: string; prompt: string; clue: string }
> = {
  "landon-storefront": {
    kind: "blend",
    title: "Compose a blend",
    prompt: "Tap three notes to add or remove them. Blend them together.",
    clue: "Your next fragment waits where a circle is served by the slice: Emporium Pies.",
  },
  "emporium-storefront": {
    kind: "slice",
    title: "Find the missing slice",
    prompt: "Turn the loose slice until it fits the gap in the pie.",
    clue: "Look for the green echo at Patina Green.",
  },
  "patina-storefront": {
    kind: "notice",
    title: "Notice something overlooked",
    prompt:
      "Choose something growing, weathered, or handmade. Let that detail shape your echo.",
    clue: "A small spark of sweetness waits at Goodies Texas.",
  },
  "goodies-hidden": {
    kind: "memory",
    title: "Remember the sweetness",
    prompt: "Watch three numbered lights, then repeat their order.",
    clue: "Find the woven door at Fair & Square.",
  },
  "fair-square-hidden": {
    kind: "weave",
    title: "Weave two halves",
    prompt:
      "Shift each row until both halves of the diamond meet in the middle.",
    clue: "Follow the rhythm to the mill setting at TUPPS.",
  },
  "tupps-hidden": {
    kind: "rhythm",
    title: "Build a rhythm",
    prompt: "Add three sound layers, then play the little rhythm you built.",
    clue: "Bring your rhythm back to the north side of MPAC.",
  },
  "mpac-meeting": {
    kind: "performance",
    title: "A small performance",
    prompt:
      "Arrange three sample motifs, then play your finale. These samples work without earlier visits.",
    clue: "The square holds many stories. This is the end of this sample journey.",
  },
  "chestnut-rooftop": {
    kind: "hold",
    title: "A moment above the square",
    prompt: "Hold the circle for three seconds to let the skyline settle.",
    clue: "Begin the next passage with a blend at Landon Winery.",
  },
};
export const SWEET_SEQUENCE = [0, 2, 1];
export function memoryStep(progress: number, choice: number) {
  return SWEET_SEQUENCE[progress] === choice ? progress + 1 : 0;
}
export function fitsSlice(rotation: number) {
  return rotation % 4 === 0;
}
export function fitsWeave(top: number, bottom: number) {
  return top === 1 && bottom === 1;
}
