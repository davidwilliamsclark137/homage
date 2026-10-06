import { Stack } from "expo-router";
import { RGB_THEME } from "../lib/theme";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: RGB_THEME.background },
        headerStyle: { backgroundColor: RGB_THEME.surface },
        headerTintColor: RGB_THEME.text,
        headerTitleStyle: { fontWeight: "800" },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="explore" options={{ headerShown: false }} />
      <Stack.Screen name="hubs" options={{ title: "Nearby hubs" }} />
      <Stack.Screen name="browse-hubs" options={{ title: "Browse places" }} />
      <Stack.Screen name="create-clue" options={{ title: "Leave a message" }} />
      <Stack.Screen name="hub" options={{ title: "Hub signal" }} />
      <Stack.Screen name="mckinney-grid" options={{ title: "Square Three" }} />
      <Stack.Screen name="mckinney-pack" options={{ title: "McKinney location pack" }} />
      <Stack.Screen name="mckinney-puzzle-lab" options={{ title: "Play Lab" }} />
      <Stack.Screen name="mckinney-simulation-lab" options={{ title: "Simulation Lab" }} />
      <Stack.Screen name="sky-lab" options={{ title: "Sky scanning lab" }} />
      <Stack.Screen name="night-encounter" options={{ title: "Two halves of the night" }} />
      <Stack.Screen name="shared-signal" options={{ title: "Shared signal" }} />
      <Stack.Screen name="rooftop-portal" options={{ title: "Portal map" }} />
      <Stack.Screen name="nine-portals" options={{ title: "Nine Portals" }} />
      <Stack.Screen name="portal/[id]" options={{ title: "Portal", headerTransparent: true, headerTintColor: "#F3F1E8" }} />
      <Stack.Screen name="experimental-portal" options={{ title: "Luminous Archive", headerTransparent: true, headerTintColor: "#F3F1E8" }} />
      <Stack.Screen name="living-signal" options={{ title: "Living Signal" }} />
      <Stack.Screen name="two-phone-simulation" options={{ title: "Two-phone Simulation" }} />
      <Stack.Screen name="board-builder" options={{ title: "Create a nine-block board" }} />
      <Stack.Screen name="signal-saboteur-multiplayer" options={{ title: "Two-phone Saboteur" }} />
      <Stack.Screen name="message-hunt" options={{ title: "Two-player hunt" }} />
    </Stack>
  );
}
