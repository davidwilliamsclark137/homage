// Both participants hear the same ordering, regardless of which part they made.
const LANDON = [
  [0, 1, 2],
  [2, 1, 0],
  [0, 2, 1],
];
const PATINA = [
  [0, 0, 1],
  [1, 0, 1],
  [2, 1, 2],
];
export function fragmentNotes(role: "landon" | "patina", choice: number) {
  return (role === "landon" ? LANDON : PATINA)[choice] ?? [];
}
export function compositionNotes(
  role: "landon" | "patina",
  own: number,
  other: number,
) {
  const landon = fragmentNotes("landon", role === "landon" ? own : other);
  const patina = fragmentNotes("patina", role === "patina" ? own : other);
  return landon.flatMap((note, index) => [note, patina[index]]);
}
