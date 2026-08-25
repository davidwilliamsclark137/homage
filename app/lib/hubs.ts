export type HubKind = "city" | "suburban" | "monument";

export type Hub = {
  id: string;
  name: string;
  locality: string;
  country: string;
  kind: HubKind;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  reason: string;
};

// Seed candidates only. Every hub must be locally checked for safe pedestrian
// access before it can become an active quest origin.
export const HUBS: Hub[] = [
  { id: "mckinney-city-hall", name: "McKinney City Hall", locality: "McKinney, Texas", country: "United States", kind: "suburban", latitude: 33.198057, longitude: -96.610596, radiusMeters: 90, reason: "Public civic building and plaza with a clear pedestrian approach." },
  { id: "mckinney-mpac", name: "McKinney Performing Arts Center (MPAC)", locality: "Downtown McKinney, Texas", country: "United States", kind: "monument", latitude: 33.19735, longitude: -96.61536, radiusMeters: 90, reason: "Historic courthouse and public square with a clear pedestrian approach." },
  { id: "richardson-heights", name: "Heights Recreation Center", locality: "Richardson, Texas", country: "United States", kind: "suburban", latitude: 32.96222, longitude: -96.74562, radiusMeters: 120, reason: "City recreation center beside a large public park and pedestrian paths." },
  { id: "richardson-huffhines", name: "Huffhines Park", locality: "Richardson, Texas", country: "United States", kind: "suburban", latitude: 32.95044, longitude: -96.69709, radiusMeters: 140, reason: "Large city park with public trails, gathering areas, and recreation facilities." },
  { id: "statue-liberty", name: "Statue of Liberty", locality: "New York City", country: "United States", kind: "monument", latitude: 40.68925, longitude: -74.0445, radiusMeters: 120, reason: "Iconic public monument with managed visitor access." },
  { id: "national-mall", name: "Lincoln Memorial", locality: "Washington, D.C.", country: "United States", kind: "city", latitude: 38.88927, longitude: -77.05018, radiusMeters: 100, reason: "Durable civic landmark in a large pedestrian public space." },
  { id: "frisco-library", name: "Frisco Public Library", locality: "Frisco, Texas", country: "United States", kind: "suburban", latitude: 33.15004, longitude: -96.82384, radiusMeters: 90, reason: "Public civic building suited to a suburban community hub." },
  { id: "bellevue-park", name: "Bellevue Downtown Park", locality: "Bellevue, Washington", country: "United States", kind: "suburban", latitude: 47.61022, longitude: -122.20436, radiusMeters: 120, reason: "Central public park with paths, gathering space, and clear access." },
  { id: "mississauga-square", name: "Celebration Square", locality: "Mississauga, Ontario", country: "Canada", kind: "suburban", latitude: 43.58892, longitude: -79.64416, radiusMeters: 110, reason: "Suburban civic square designed for public gathering." },
  { id: "angel-independence", name: "Angel of Independence", locality: "Mexico City", country: "Mexico", kind: "monument", latitude: 19.42703, longitude: -99.16766, radiusMeters: 100, reason: "Highly recognizable civic monument in the city center." },
  { id: "christ-redeemer", name: "Christ the Redeemer", locality: "Rio de Janeiro", country: "Brazil", kind: "monument", latitude: -22.95192, longitude: -43.21049, radiusMeters: 130, reason: "Globally recognized monument with a formal visitor area." },
  { id: "eiffel-tower", name: "Eiffel Tower", locality: "Paris", country: "France", kind: "monument", latitude: 48.85837, longitude: 2.29448, radiusMeters: 140, reason: "Distinct landmark surrounded by pedestrian public space." },
  { id: "trafalgar-square", name: "Trafalgar Square", locality: "London", country: "United Kingdom", kind: "city", latitude: 51.50804, longitude: -0.12807, radiusMeters: 120, reason: "Central civic plaza with monuments and public gathering space." },
  { id: "croydon-clocktower", name: "Croydon Clocktower", locality: "Croydon", country: "United Kingdom", kind: "suburban", latitude: 51.37266, longitude: -0.09896, radiusMeters: 80, reason: "Library and civic complex serving an outer urban community." },
  { id: "colosseum", name: "Colosseum", locality: "Rome", country: "Italy", kind: "monument", latitude: 41.89021, longitude: 12.49223, radiusMeters: 140, reason: "Durable historic landmark with established visitor circulation." },
  { id: "acropolis", name: "Acropolis of Athens", locality: "Athens", country: "Greece", kind: "monument", latitude: 37.97153, longitude: 23.72575, radiusMeters: 160, reason: "Globally significant historic site with managed access." },
  { id: "great-sphinx", name: "Great Sphinx of Giza", locality: "Giza", country: "Egypt", kind: "monument", latitude: 29.97527, longitude: 31.13757, radiusMeters: 160, reason: "Internationally recognized monument in a formal heritage site." },
  { id: "cape-town-city-hall", name: "Cape Town City Hall", locality: "Cape Town", country: "South Africa", kind: "city", latitude: -33.92554, longitude: 18.42388, radiusMeters: 90, reason: "Prominent civic building beside a public square." },
  { id: "gateway-india", name: "Gateway of India", locality: "Mumbai", country: "India", kind: "monument", latitude: 18.92198, longitude: 72.83465, radiusMeters: 120, reason: "Recognizable waterfront monument and public meeting place." },
  { id: "merlion", name: "Merlion Park", locality: "Singapore", country: "Singapore", kind: "city", latitude: 1.28682, longitude: 103.85453, radiusMeters: 90, reason: "Accessible waterfront landmark with strong visual identity." },
  { id: "tokyo-station", name: "Tokyo Station Marunouchi Plaza", locality: "Tokyo", country: "Japan", kind: "city", latitude: 35.68124, longitude: 139.76712, radiusMeters: 110, reason: "Major public landmark with a broad pedestrian forecourt." },
  { id: "parramatta-square", name: "Parramatta Square", locality: "Parramatta, New South Wales", country: "Australia", kind: "suburban", latitude: -33.81505, longitude: 151.00112, radiusMeters: 100, reason: "Transit-connected civic square for a suburban city center." },
  { id: "sydney-opera", name: "Sydney Opera House", locality: "Sydney", country: "Australia", kind: "monument", latitude: -33.85678, longitude: 151.2153, radiusMeters: 140, reason: "Globally recognizable cultural building and public forecourt." },
];
