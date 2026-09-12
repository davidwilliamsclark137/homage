export type McKinneyPuzzleMechanic = "observe" | "sequence" | "cipher" | "grid" | "route";

export type McKinneyPackSite = {
  id: string;
  name: string;
  shortName: string;
  address: string;
  latitude: number;
  longitude: number;
  activationRadiusMeters: number;
  sourceVerified: boolean;
  fieldVerified: boolean;
  historicalContext: string;
  publicObservation: string;
  puzzleMechanics: McKinneyPuzzleMechanic[];
  puzzleSeed: string;
  sourceLabel: string;
  sourceUrl: string;
  safetyNote: string;
};

export const MCKINNEY_PACK = {
  id: "mckinney-downtown-v1",
  name: "Historic Downtown McKinney",
  version: 1,
  status: "field-test",
  center: { latitude: 33.19735, longitude: -96.61536 },
  description: "A source-backed puzzle layer centered on the courthouse square, its civic history, architecture, and walkable public spaces.",
  sites: [
    {
      id: "mckinney-mpac",
      name: "McKinney Performing Arts Center / Historic Courthouse",
      shortName: "MPAC",
      address: "111 N. Tennessee St.",
      latitude: 33.19735,
      longitude: -96.61536,
      activationRadiusMeters: 90,
      sourceVerified: true,
      fieldVerified: false,
      historicalContext: "The courthouse square dates to McKinney’s establishment as the county seat. The present building reflects major work completed in 1927 and is documented as Classical Revival architecture.",
      publicObservation: "From the public square, compare the north and south façades and look for repeated classical forms.",
      puzzleMechanics: ["observe", "grid", "sequence"],
      puzzleSeed: "Use a field-verified count of repeated façade elements to place fixed Square Three tiles.",
      sourceLabel: "Texas Historical Commission courthouse record",
      sourceUrl: "https://atlas.thc.texas.gov/Details/5085011816",
      safetyNote: "Remain on the public square and sidewalks; no building entry is required.",
    },
    {
      id: "downtown-kiosk",
      name: "Downtown History Kiosk",
      shortName: "History Kiosk",
      address: "Southwest corner of Kentucky and Virginia",
      latitude: 33.19768,
      longitude: -96.61623,
      activationRadiusMeters: 55,
      sourceVerified: true,
      fieldVerified: false,
      historicalContext: "The city’s historic tour identifies original interurban rail and Thurber paving bricks at the kiosk and connects the location to rail service that crossed downtown.",
      publicObservation: "Find the rail-and-brick display from the public sidewalk and identify which way the former line traveled.",
      puzzleMechanics: ["observe", "route", "cipher"],
      puzzleSeed: "The rail orientation can determine the reading direction for a later clue.",
      sourceLabel: "City of McKinney Historic Downtown Tour",
      sourceUrl: "https://maps.mckinneytexas.org/documents/historicpreservation/HistDownTour/details/HistDownTourDetails.html",
      safetyNote: "Observe from the corner without entering the street.",
    },
    {
      id: "first-national-bank",
      name: "First National Bank Building",
      shortName: "First National Bank",
      address: "110 N. Tennessee St.",
      latitude: 33.19738,
      longitude: -96.61498,
      activationRadiusMeters: 45,
      sourceVerified: true,
      fieldVerified: false,
      historicalContext: "The city tour identifies this as downtown McKinney’s example of Beaux-Arts Classicism and describes classical columns, an enriched upper façade, and eagle ornamentation.",
      publicObservation: "From public space, locate the high architectural ornament without relying on the current tenant or storefront signs.",
      puzzleMechanics: ["observe", "sequence"],
      puzzleSeed: "A verified count or left-to-right order of permanent ornaments can encode a grid position.",
      sourceLabel: "City of McKinney Historic Downtown Tour",
      sourceUrl: "https://maps.mckinneytexas.org/documents/historicpreservation/HistDownTour/details/HistDownTourDetails.html",
      safetyNote: "Use the sidewalk and look upward only while standing still.",
    },
    {
      id: "heard-opera-house",
      name: "Heard Opera House Block",
      shortName: "Heard Opera House",
      address: "114 W. Louisiana St.",
      latitude: 33.19715,
      longitude: -96.61605,
      activationRadiusMeters: 50,
      sourceVerified: true,
      fieldVerified: false,
      historicalContext: "The city’s tour records the upper portion as the former Heard Opera House and distinguishes verified history from a local Sousa-premiere legend.",
      publicObservation: "Compare the upper historic portion with the active ground-floor storefront while avoiding business-dependent clues.",
      puzzleMechanics: ["observe", "cipher"],
      puzzleSeed: "A then-and-now clue can ask players to identify which level preserves the older story.",
      sourceLabel: "City of McKinney Historic Downtown Tour",
      sourceUrl: "https://maps.mckinneytexas.org/documents/historicpreservation/HistDownTour/details/HistDownTourDetails.html",
      safetyNote: "The clue must be solvable from the public sidewalk regardless of business hours.",
    },
    {
      id: "collin-history-museum",
      name: "Collin County History Museum / Former Post Office",
      shortName: "History Museum",
      address: "300 E. Virginia St.",
      latitude: 33.19794,
      longitude: -96.61257,
      activationRadiusMeters: 65,
      sourceVerified: true,
      fieldVerified: false,
      historicalContext: "The city identifies the museum’s building as a 1911 Texas Historic Landmark preserving McKinney and Collin County history.",
      publicObservation: "Inspect only permanent exterior features unless a puzzle explicitly states that the museum is open.",
      puzzleMechanics: ["observe", "route"],
      puzzleSeed: "Use this as an eastward waypoint linking the historic square to the civic district.",
      sourceLabel: "City of McKinney attractions and museums",
      sourceUrl: "https://www.mckinneytexas.org/1949/Downtown-Tours",
      safetyNote: "Exterior puzzles remain available when the museum is closed.",
    },
    {
      id: "mitchell-park",
      name: "Mitchell Memorial Park",
      shortName: "Mitchell Park",
      address: "300 W. Louisiana St.",
      latitude: 33.1976,
      longitude: -96.61778,
      activationRadiusMeters: 120,
      sourceVerified: true,
      fieldVerified: false,
      historicalContext: "A public green-space checkpoint that extends the route west of the courthouse square and gives the puzzle a change in texture from architecture to landscape.",
      publicObservation: "Use durable paths, monuments, or landscape relationships only after an on-site check.",
      puzzleMechanics: ["route", "grid", "observe"],
      puzzleSeed: "Close the walking grid with a westward checkpoint and a field-verified permanent feature.",
      sourceLabel: "City of McKinney parks and trails",
      sourceUrl: "https://www.mckinneytexas.org/612/Parks-Trails",
      safetyNote: "Use the park only during posted hours and pause for weather, traffic, or poor lighting.",
    },
  ] satisfies McKinneyPackSite[],
};
