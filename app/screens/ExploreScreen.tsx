import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";
import React, { useEffect, useState } from "react";
import { View, Text, Button, Alert } from "react-native";
import { useQuestSync } from "../hooks/useQuestSync";

const COLORS = ["#2dd4bf","#60a5fa","#f59e0b","#f43f5e","#a78bfa","#34d399"];

function mkNearby(lat: number, lng: number) {
  const offsets = [
    { dLat: 0.001, dLng: 0 },
    { dLat: -0.0007, dLng: 0.0007 },
    { dLat: 0, dLng: -0.0012 },
  ];
  return offsets.map((o, i) => ({
    id: `auto-${i}`,
    title: `Auto-Spawn POI ${i + 1}`,
    coordinate: { latitude: lat + o.dLat, longitude: lng + o.dLng },
    color: COLORS[i % COLORS.length],
  }));
}

export default function ExploreScreen() {
  const { refetchDelta } = useQuestSync();
  const [region, setRegion] = useState<any | null>(null);
  const [pois, setPois] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location needed", "Enable location to auto-spawn quests.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      setRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      setPois(mkNearby(latitude, longitude));
    })();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {region ? (
        <MapView style={{ flex: 1 }} region={region} onRegionChangeComplete={setRegion}>
          {pois.map((p) => (
            <Marker key={p.id} coordinate={p.coordinate} title={p.title} pinColor={p.color} />
          ))}
        </MapView>
      ) : (
        <View style={{ padding: 16 }}><Text>Getting your location…</Text></View>
      )}
      <View style={{ padding: 12, gap: 8 }}>
        <Button title="Refresh quests" onPress={() => refetchDelta()} />
      </View>
    </View>
  );
}

