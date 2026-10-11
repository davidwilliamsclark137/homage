// Story connections, not pedestrian routing. A choice advances only after the
// current activity is complete. Preview progress stays in memory, never GPS data.
export const CONNECTIONS: Record<string, string[]> = {
  "landon-storefront": ["emporium-storefront", "patina-storefront"],
  "emporium-storefront": ["fair-square-hidden"],
  "patina-storefront": ["goodies-hidden"],
  "goodies-hidden": ["fair-square-hidden"],
  "fair-square-hidden": ["tupps-hidden", "mpac-meeting"],
  "tupps-hidden": ["mpac-meeting"],
  "chestnut-rooftop": ["landon-storefront"],
  "mpac-meeting": [],
};
export type Journey = { path: string[]; completed: string[] };
export const beginJourney = (): Journey => ({
  path: ["landon-storefront"],
  completed: [],
});
export const currentStop = (journey: Journey) =>
  journey.path[journey.path.length - 1];
export function completeStop(journey: Journey, id: string): Journey {
  if (id !== currentStop(journey) || journey.completed.includes(id))
    return journey;
  return { ...journey, completed: [...journey.completed, id] };
}
export function nextStops(journey: Journey): string[] {
  const current = currentStop(journey);
  return journey.completed.includes(current)
    ? (CONNECTIONS[current] ?? [])
    : [];
}
export function chooseStop(journey: Journey, id: string): Journey {
  return nextStops(journey).includes(id)
    ? { ...journey, path: [...journey.path, id] }
    : journey;
}
export function journeyFinished(journey: Journey) {
  return (
    currentStop(journey) === "mpac-meeting" &&
    journey.completed.includes("mpac-meeting")
  );
}
