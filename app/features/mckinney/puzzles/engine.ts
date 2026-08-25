import { MCKINNEY_PACK, type McKinneyPackSite } from "../data/locationPack";

export type PuzzleFormat = "i-spy" | "hide-seek" | "tag" | "bingo" | "jeopardy" | "maze" | "hidden-maze" | "capture-flag";

export type GeneratedMcKinneyPuzzle = {
  id: string;
  format: PuzzleFormat;
  title: string;
  playerLabel: string;
  duration: string;
  objective: string;
  instructions: string[];
  sites: McKinneyPackSite[];
  verification: string;
  safety: string;
};

export type McKinneyHomePreview = {
  format: PuzzleFormat;
  scene: string;
  prompt: string;
  choices?: string[];
  answer: string;
  explanation: string;
  sourceNote: string;
};

export const PUZZLE_FORMATS: { id: PuzzleFormat; name: string; summary: string }[] = [
  { id: "i-spy", name: "I Spy", summary: "Find permanent details in public view." },
  { id: "hide-seek", name: "Signal Hide & Seek", summary: "One player chooses a virtual hiding hub; the other follows clues." },
  { id: "tag", name: "Signal Tag", summary: "Take turns claiming safe location zones—no chasing." },
  { id: "bingo", name: "Downtown Bingo", summary: "Complete a card of observable place-based discoveries." },
  { id: "jeopardy", name: "McKinney Jeopardy", summary: "Answer sourced questions after reaching their locations." },
  { id: "maze", name: "Street Maze", summary: "Choose the correct checkpoint sequence through downtown." },
  { id: "hidden-maze", name: "Hidden Maze", summary: "The route appears one decision at a time." },
  { id: "capture-flag", name: "Capture the Signal", summary: "Teams claim virtual flags at public hubs." },
];

export const MCKINNEY_HOME_PREVIEWS: Record<PuzzleFormat, McKinneyHomePreview> = {
  "i-spy": { format: "i-spy", scene: "Imagine you are standing on Tennessee Street facing the historic commercial buildings.", prompt: "I spy a downtown building the city identifies by classical columns and eagle ornamentation. Which location am I describing?", choices: ["MPAC", "First National Bank Building", "Mitchell Park"], answer: "First National Bank Building", explanation: "The official downtown tour identifies 110 N. Tennessee as McKinney’s Beaux-Arts Classical example and describes its columns and eagle ornamentation.", sourceNote: "City of McKinney Historic Downtown Tour" },
  "hide-seek": { format: "hide-seek", scene: "Player 1 has hidden a virtual signal at one of the pack’s locations.", prompt: "Clue 1: I stand at the center of a prototypical courthouse square. Clue 2: extensive work completed in 1927 gave me a Classical Revival appearance. Where is the signal?", choices: ["History Kiosk", "MPAC / Historic Courthouse", "Heard Opera House"], answer: "MPAC / Historic Courthouse", explanation: "Both clues describe the historic courthouse now used as MPAC. In the live game, the address would appear only after an incorrect guess.", sourceNote: "Texas Historical Commission and City of McKinney tour" },
  tag: { format: "tag", scene: "This is turn-based signal tag—no running or chasing. Each correct answer claims a virtual zone.", prompt: "Player 1 claims MPAC. Which different zone should Player 2 claim if the clue says ‘original interurban rail and Thurber paving bricks’?", choices: ["Downtown History Kiosk", "History Museum", "Mitchell Park"], answer: "Downtown History Kiosk", explanation: "The city’s tour associates those materials with the downtown kiosk. A live correct answer would claim that GPS zone for Player 2.", sourceNote: "City of McKinney Historic Downtown Tour" },
  bingo: { format: "bingo", scene: "At home, treat the center row as a knowledge preview. Downtown, each square becomes an observation task.", prompt: "Complete this row: courthouse remodeled in 1927 · ______ · former opera-house block. The missing square is the site tied to interurban rail.", choices: ["Downtown History Kiosk", "City Hall", "Mitchell Park"], answer: "Downtown History Kiosk", explanation: "A live bingo card would mix sourced history with field-verified visual discoveries. Three verified discoveries in a row complete the card.", sourceNote: "City of McKinney Historic Downtown Tour" },
  jeopardy: { format: "jeopardy", scene: "Category: BUILDINGS WITH SECOND LIVES for $300.", prompt: "This 1927 Classical Revival landmark served as a courthouse until 1979 and now contains a performing-arts center.", choices: ["What is MPAC?", "What is the Heard Opera House?", "What is the History Museum?"], answer: "What is MPAC?", explanation: "The response is phrased as a question, Jeopardy-style. Reaching the real location could unlock a harder architectural follow-up.", sourceNote: "Texas Historical Commission courthouse record" },
  maze: { format: "maze", scene: "You are navigating a story maze. Correct facts choose the next node; wrong answers return to the previous node.", prompt: "From MPAC, choose the node connected to McKinney’s former interurban route rather than the former opera house.", choices: ["History Kiosk", "Heard Opera House", "Mitchell Park"], answer: "History Kiosk", explanation: "The correct historical relationship opens the kiosk node. Downtown, the app would reveal the next walking leg only after the answer.", sourceNote: "City of McKinney Historic Downtown Tour" },
  "hidden-maze": { format: "hidden-maze", scene: "Only your current node and two possible exits are visible. The complete maze remains hidden.", prompt: "MPAC node: take the EAGLE exit or the RAIL exit. Your destination must be the building identified with Beaux-Arts ornamentation.", choices: ["EAGLE → First National Bank", "RAIL → History Kiosk"], answer: "EAGLE → First National Bank", explanation: "Solving the location relationship reveals that edge of the maze. The rail edge remains hidden until encountered from another node.", sourceNote: "City of McKinney Historic Downtown Tour" },
  "capture-flag": { format: "capture-flag", scene: "Two teams compete for virtual flags. This preview simulates one flag challenge.", prompt: "The GOLD FLAG says: ‘Capture me at the downtown site whose upper portion once held an opera house.’ Which zone do you claim?", choices: ["Heard Opera House Block", "MPAC", "History Museum"], answer: "Heard Opera House Block", explanation: "A correct answer plus a safe GPS check-in captures the virtual flag. No object is hidden and teams never chase or block each other.", sourceNote: "City of McKinney Historic Downtown Tour" },
};

export function generateMcKinneyPuzzle(format: PuzzleFormat, seed = Date.now()): GeneratedMcKinneyPuzzle {
  const sites = rotate(MCKINNEY_PACK.sites, seed).slice(0, format === "bingo" ? 5 : format === "jeopardy" ? 4 : 3);
  const names = sites.map((site) => site.shortName);
  const base = { id: `${format}-${seed}`, format, sites, verification: "Historical context is source-backed. Every visual answer remains provisional until its site is field-verified.", safety: "Use public sidewalks and crossings. Never run, chase, hide objects, enter private property, or play while driving." };

  switch (format) {
    case "i-spy": return { ...base, title: "I Spy: Permanent Details", playerLabel: "1–2 players", duration: "15–25 min", objective: `Inspect ${names.join(", ")} and identify one permanent feature at each stop.`, instructions: sites.map((site) => `${site.shortName}: ${site.publicObservation}`) };
    case "hide-seek": return { ...base, title: "Signal Hide & Seek", playerLabel: "2 players", duration: "20–35 min", objective: "Player 1 secretly selects one virtual hub. Player 2 identifies it using progressively clearer clues.", instructions: ["Player 1 selects one of the listed sites in the app—players do not physically hide.", "Reveal a historical-context clue, then a puzzle-mechanic clue, then the address if needed.", "Player 2 wins by checking into the correct public activation zone."] };
    case "tag": return { ...base, title: "Turn-Based Signal Tag", playerLabel: "2 players", duration: "20–30 min", objective: "Score by taking turns checking into different downtown zones.", instructions: [`Use ${names.join(", ")} as the active zones.`, "Player 1 claims a zone, then stops moving and passes the turn.", "Player 2 claims a different zone. First to three safe check-ins wins; there is no chasing or time pressure."] };
    case "bingo": return { ...base, title: "Downtown Discovery Bingo", playerLabel: "1–4 players", duration: "30–45 min", objective: "Complete three discoveries in a row using only permanent, publicly visible details.", instructions: sites.map((site) => `${site.shortName}: confirm a durable observation related to ${site.puzzleMechanics.join(" or ")}.`) };
    case "jeopardy": return { ...base, title: "McKinney Field Jeopardy", playerLabel: "2+ players", duration: "25–40 min", objective: "Reach a location to unlock a sourced answer, then respond in question form.", instructions: sites.map((site, index) => `$${(index + 1) * 100} · ${site.shortName}: ${site.historicalContext}`) };
    case "maze": return { ...base, title: "Courthouse Street Maze", playerLabel: "1–2 players", duration: "25–40 min", objective: `Discover the correct route through ${names.join(" → ")}.`, instructions: ["Each solved observation reveals which listed checkpoint comes next.", "A wrong answer returns the player to the previous safe checkpoint, not a physical dead end.", "Complete the ordered route to reveal the final encrypted-message key order."] };
    case "hidden-maze": return { ...base, title: "The Invisible Sidewalk Maze", playerLabel: "1–2 players", duration: "30–45 min", objective: "Navigate a hidden route on public downtown sidewalks while the nine blocks act as landmarks.", instructions: ["The app reveals only the current sidewalk segment and two possible turns.", "Solve the current place-based clue to expose the next safe segment or crossing.", "Discovered sidewalk segments remain on the map; complete the route back at MPAC."] };
    case "capture-flag": return { ...base, title: "Capture the Signal", playerLabel: "2 players or teams", duration: "30–45 min", objective: "Capture virtual flags by solving a location clue inside each activation zone.", instructions: [`Virtual flags are placed at ${names.join(", ")}; nothing is physically hidden.`, "Teams alternate turns and may not block, follow, or chase one another.", "A solved clue captures a flag. Most flags after the agreed time wins."] };
  }
}

function rotate<T>(values: readonly T[], seed: number): T[] {
  const start = Math.abs(seed) % values.length;
  return [...values.slice(start), ...values.slice(0, start)];
}
