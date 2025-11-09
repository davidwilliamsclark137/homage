// app/_layout.tsx — minimal router layout (no aliases, no custom hooks)
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#111" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "600" },
      }}
    />
  );
}

