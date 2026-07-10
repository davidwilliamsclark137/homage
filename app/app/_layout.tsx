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
      <Stack.Screen name="index" options={{ title: "Homage" }} />
      <Stack.Screen name="admin" options={{ title: "Admin Dashboard" }} />
      <Stack.Screen name="pair-device" options={{ title: "Pair Device" }} />
      <Stack.Screen name="terminal" options={{ title: "Terminal" }} />
      <Stack.Screen name="artifacts" options={{ title: "Artifacts" }} />
      <Stack.Screen name="ui-lab" options={{ title: "UI Lab" }} />
      <Stack.Screen name="rainbow-bit" options={{ title: "8-bit Demo" }} />
      <Stack.Screen
        name="document-studio"
        options={{ title: "Document Studio" }}
      />
    </Stack>
  );
}
