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
      <Stack.Screen
        name="document-studio"
        options={{ title: "Homage Document Studio" }}
      />
    </Stack>
  );
}
