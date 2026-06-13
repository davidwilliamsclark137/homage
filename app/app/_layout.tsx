import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Homage" }} />
      <Stack.Screen name="capture" options={{ title: "Capture" }} />
      <Stack.Screen name="map" options={{ title: "Map" }} />
      <Stack.Screen name="game" options={{ title: "Explore Game" }} />
      <Stack.Screen name="health" options={{ title: "Backend Health" }} />
      <Stack.Screen name="completed" options={{ title: "Completed Quests" }} />
    </Stack>
  );
}

