export type SimulationCellState = "quiet" | "active" | "player" | "clue" | "blocked" | "corrupted" | "solved" | "x" | "o";
export type SimulationStep = { title: string; detail: string; cells: Record<number, SimulationCellState> };
export type SimulationModule = { id: string; name: string; question: string; players: string; steps: SimulationStep[] };

export const NINE_BUILDINGS = ["Harvest Block", "Magic Needle Block", "Antique Company Block", "Shorty’s Block", "MPAC Block", "Celt Block", "Cadillac Block", "Centro Block", "Filtered Block"];

export const SIMULATION_MODULES: SimulationModule[] = [
  { id: "living-signal", name: "Living Signal", question: "Can portal rules, physical movement and a changing graph become one understandable game?", players: "1–2 players + Ghost", steps: [
    { title: "MPAC wakes", detail: "The center portal becomes the source. Its street-adjacent neighbors become possible moves.", cells: { 4:"player",1:"active",3:"active",5:"active",7:"active" } },
    { title: "Tune a portal", detail: "A visual phase challenge stabilizes one adjacent node and reveals its graph rule.", cells: { 3:"solved",4:"solved" } },
    { title: "Route the signal", detail: "The new node opens its neighbors. A corrupted phase spends a move and fractures that portal.", cells: { 3:"solved",4:"solved",6:"active" } },
    { title: "Complete the graph", detail: "Form the target three-node path within six moves to decrypt its hidden payload.", cells: { 3:"solved",4:"solved",6:"solved" } },
  ]},
  { id: "portal-network", name: "Portal Network", question: "Can nine location-locked fractal spaces make the downtown blocks feel distinct?", players: "1+ explorers", steps: [
    { title: "Nine dormant portals", detail: "Each downtown block owns one distinct fractal simulation. Field mode keeps it locked until a player reaches that block.", cells: {} },
    { title: "Approach a block", detail: "The nearest block becomes the only available portal, preventing remote entry during a live game.", cells: { 4: "player" } },
    { title: "Enter its signal", detail: "The block opens its own interactive fractal space. Simulation mode can preview all nine from anywhere.", cells: { 4: "solved" } },
  ]},
  { id: "saboteur", name: "Signal Saboteur", question: "Can one player create a believable story while the other inspects limited evidence?", players: "2 players + Ghost", steps: [
    { title: "Roles assigned", detail: "Player 1 investigates. Player 2 privately stabilizes or sabotages. The Ghost creates uncertainty.", cells: { 4: "player", 7: "player" } },
    { title: "Hidden actions", detail: "Player 2 acts at Shorty’s Block while the Ghost touches Harvest Block.", cells: { 0: "corrupted", 3: "player", 4: "clue" } },
    { title: "One inspection", detail: "Player 1 inspects one block and receives only that cell’s record.", cells: { 0: "corrupted", 3: "clue", 4: "player" } },
    { title: "Accusation", detail: "After three rounds, Player 1 accuses Player 2 or the Ghost.", cells: { 0: "corrupted", 3: "solved", 4: "solved" } },
  ]},
  { id: "square-three", name: "Square Three", question: "Can physical checkpoints provide the fixed entries for a compact location Sudoku?", players: "1–2 players", steps: [
    { title: "Empty square", detail: "All nine buildings are cells in a 3×3 Latin-square puzzle.", cells: {} },
    { title: "Collect givens", detail: "Visiting three locations reveals fixed values.", cells: { 0: "clue", 4: "clue", 8: "clue" } },
    { title: "Fill the pattern", detail: "Players complete rows and columns with 1, 2, and 3.", cells: { 0: "solved", 1: "active", 2: "active", 3: "active", 4: "solved", 5: "active", 6: "active", 7: "active", 8: "solved" } },
    { title: "Unlock the message", detail: "The completed grid supplies the extraction order for an encrypted clue.", cells: { 0: "solved", 1: "solved", 2: "solved", 3: "solved", 4: "solved", 5: "solved", 6: "solved", 7: "solved", 8: "solved" } },
  ]},
  { id: "hidden-maze", name: "Hidden Maze", question: "Is revealing only the next possible buildings enough to create discovery without confusion?", players: "1–2 players", steps: [
    { title: "Start on the sidewalk", detail: "Begin at the public sidewalk beside MPAC. Only the first route decision is visible.", cells: { 4: "player", 1: "active", 5: "active" } },
    { title: "Reveal one walking edge", detail: "A solved clue reveals the next sidewalk segment and safe crossing—not a path through a block.", cells: { 1: "clue", 4: "solved", 5: "blocked" } },
    { title: "The street maze expands", detail: "The discovered sidewalk stays visible while the next intersection presents two possible directions.", cells: { 0: "active", 1: "player", 2: "active", 4: "solved" } },
    { title: "Loop back to MPAC", detail: "The final solved segment follows public sidewalks back to the center block for the unlock.", cells: { 0: "solved", 1: "solved", 2: "solved", 4: "player", 5: "solved" } },
  ]},
  { id: "i-spy", name: "I Spy", question: "Can permanent architectural observations become clear, fair answers?", players: "1–4 players", steps: [
    { title: "Receive one prompt", detail: "Example: find the building associated with classical columns and eagle ornamentation.", cells: { 0: "clue", 1: "clue", 2: "clue" } },
    { title: "Compare candidates", detail: "Players inspect public-facing details across nearby buildings.", cells: { 0: "active", 1: "active", 2: "active" } },
    { title: "Commit an answer", detail: "Selecting the correct building records the observation.", cells: { 1: "solved" } },
  ]},
  { id: "message-hunt", name: "Encrypted Hunt", question: "Does a physical puzzle make opening another player’s message feel earned?", players: "2 players", steps: [
    { title: "Player 1 leaves a message", detail: "The encrypted message is attached to one building cell.", cells: { 4: "clue" } },
    { title: "Player 2 joins", detail: "A room code reveals the board but not the unlock phrase.", cells: { 4: "active", 7: "player" } },
    { title: "Complete a module", detail: "A maze, I Spy clue, or Square Three supplies evidence toward the phrase.", cells: { 1: "solved", 4: "clue", 7: "solved" } },
    { title: "Open at the hub", detail: "The final phrase decrypts the message and notifies Player 1.", cells: { 4: "solved" } },
  ]},
  { id: "bingo", name: "Downtown Bingo", question: "Can nine short observations create a flexible, replayable exploration card?", players: "1–4 players", steps: [
    { title: "Nine observations", detail: "Each building cell contains one sourced discovery task.", cells: { 0: "clue", 1: "clue", 2: "clue", 3: "clue", 4: "clue", 5: "clue", 6: "clue", 7: "clue", 8: "clue" } },
    { title: "Mark discoveries", detail: "Players complete cells in any safe order.", cells: { 0: "solved", 4: "solved", 7: "solved" } },
    { title: "Complete a line", detail: "Three verified discoveries in a row, column, or diagonal finish the card.", cells: { 0: "solved", 4: "solved", 8: "solved" } },
  ]},
  { id: "tic-tac-toe", name: "Building Tic-Tac-Toe", question: "Does claiming real building cells add enough strategy to a familiar three-in-a-row game?", players: "2 players", steps: [
    { title: "Nine open buildings", detail: "Each downtown block is one square. A player claims a building by completing its short challenge.", cells: {} },
    { title: "X takes the center", detail: "Player X completes the MPAC challenge and claims the center building.", cells: { 4: "x" } },
    { title: "O blocks a corner", detail: "Player O claims Antique Company Block while X claims Harvest Block.", cells: { 0: "x", 2: "o", 4: "x" } },
    { title: "The diagonal closes", detail: "Player X claims Filtered Block to complete Harvest → MPAC → Filtered.", cells: { 0: "x", 2: "o", 4: "x", 7: "o", 8: "x" } },
  ]},
];
