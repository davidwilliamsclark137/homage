type Pausable = { pause: () => void };

// Expo's player hooks release native objects before later effect cleanups run.
// Teardown must tolerate an already-released player and still stop its peers.
export function pausePlayers(players: readonly Pausable[]) {
  for (const player of players) {
    try {
      player.pause();
    } catch {
      // A released native player has already stopped and cannot be paused again.
    }
  }
}
