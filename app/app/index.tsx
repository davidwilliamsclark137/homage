// app/app/index.tsx
import React from "react";
import { Pressable, View, Text, StyleSheet } from "react-native";
import { Href, useRouter } from "expo-router";
import { RGB_THEME } from "../lib/theme";

const HOME_LINKS = [
  { href: "/document-studio", label: "Open Document Studio", style: "primaryLink" },
  { href: "/admin", label: "Admin Dashboard", style: "adminLink" },
  { href: "/pair-device", label: "Pair Device", style: "pairLink" },
  { href: "/terminal", label: "Terminal Help", style: "terminalLink" },
] as const;

export default function Home() {
  const router = useRouter();

  function open(href: Href) {
    router.push(href);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Homage</Text>
      <View style={styles.rgbRail}>
        <View style={[styles.rgbSegment, { backgroundColor: RGB_THEME.cyan }]} />
        <View
          style={[styles.rgbSegment, { backgroundColor: RGB_THEME.magenta }]}
        />
        <View style={[styles.rgbSegment, { backgroundColor: RGB_THEME.lime }]} />
      </View>
      <Text style={styles.subtitle}>A place becomes a signal.</Text>
      <Text style={styles.description}>
        Write, design, publish, and collect local-first documents.
      </Text>

      {HOME_LINKS.map((item) => (
        <Pressable
          key={item.href}
          onPress={() => open(item.href)}
          style={styles[item.style]}
        >
          <Text style={styles[`${item.style}Text`]}>{item.label}</Text>
        </Pressable>
      ))}

      <View style={styles.collectionLinks}>
        <Pressable onPress={() => open("/artifacts")} style={styles.secondaryLink}>
          <Text style={styles.secondaryLinkText}>Artifacts</Text>
        </Pressable>
        <Pressable onPress={() => open("/ui-lab")} style={styles.secondaryLink}>
          <Text style={styles.secondaryLinkText}>UI Lab</Text>
        </Pressable>
        <Pressable onPress={() => open("/rainbow-bit")} style={styles.secondaryLink}>
          <Text style={styles.secondaryLinkText}>8-bit Demo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: RGB_THEME.background,
    flex: 1,
    justifyContent: "center",
    padding: 28,
  },
  title: { color: RGB_THEME.text, fontSize: 34, fontWeight: "900" },
  rgbRail: {
    flexDirection: "row",
    gap: 5,
    marginTop: 12,
    width: 116,
  },
  rgbSegment: { flex: 1, height: 3 },
  subtitle: {
    color: RGB_THEME.cyan,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 8,
  },
  description: {
    color: RGB_THEME.muted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
  },
  primaryLink: {
    alignItems: "center",
    backgroundColor: RGB_THEME.cyan,
    borderRadius: 6,
    marginTop: 32,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  primaryLinkText: {
    color: RGB_THEME.black,
    fontSize: 17,
    fontWeight: "800",
  },
  adminLink: {
    alignItems: "center",
    backgroundColor: RGB_THEME.surfaceRaised,
    borderColor: RGB_THEME.amber,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  adminLinkText: {
    color: RGB_THEME.amber,
    fontSize: 15,
    fontWeight: "900",
  },
  pairLink: {
    alignItems: "center",
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.lime,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  pairLinkText: {
    color: RGB_THEME.lime,
    fontSize: 15,
    fontWeight: "900",
  },
  terminalLink: {
    alignItems: "center",
    backgroundColor: RGB_THEME.black,
    borderColor: RGB_THEME.cyan,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  terminalLinkText: {
    color: RGB_THEME.cyan,
    fontSize: 15,
    fontWeight: "900",
  },
  collectionLinks: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  secondaryLink: {
    alignItems: "center",
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    padding: 13,
  },
  secondaryLinkText: {
    color: RGB_THEME.text,
    fontSize: 14,
    fontWeight: "800",
  },
});
