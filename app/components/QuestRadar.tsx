import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, {
  Circle,
  Line,
  Text as SvgText,
} from "react-native-svg";

import { GeneratedQuest } from "../api";
import { haversine, LatLng } from "../lib/geo";
import { RGB_THEME } from "../lib/theme";

type Props = {
  location: LatLng;
  target: GeneratedQuest | undefined;
  inRange: boolean;
  melodyCollected: boolean;
};

export default function QuestRadar({
  location,
  target,
  inRange,
  melodyCollected,
}: Props) {
  const window = useWindowDimensions();
  const width = window.width;
  const availableHeight = Math.max(300, window.height - 290);
  const centerX = width / 2;
  const centerY = availableHeight / 2 + 30;
  const radius = Math.max(110, Math.min(width * 0.42, availableHeight * 0.4));
  const targetCoordinate = target
    ? { latitude: target.latitude, longitude: target.longitude }
    : null;
  const distance = targetCoordinate
    ? haversine(location, targetCoordinate)
    : 0;
  const bearing = targetCoordinate
    ? bearingDegrees(location, targetCoordinate)
    : 0;
  const scaleMeters = Math.max(
    150,
    Math.min(3_000, distance * 1.18),
    (target?.radius ?? 50) * 2,
  );
  const targetRadius = Math.min(radius - 12, (distance / scaleMeters) * radius);
  const bearingRadians = (bearing * Math.PI) / 180;
  const markerX = centerX + Math.sin(bearingRadians) * targetRadius;
  const markerY = centerY - Math.cos(bearingRadians) * targetRadius;
  const markerColor = inRange
    ? RGB_THEME.lime
    : melodyCollected
      ? RGB_THEME.cyan
      : RGB_THEME.magenta;

  return (
    <View style={styles.container}>
      <Svg height={window.height} width={width}>
        <Circle cx={centerX} cy={centerY} fill={RGB_THEME.black} r={radius} />
        {[0.33, 0.66, 1].map((fraction) => (
          <Circle
            key={fraction}
            cx={centerX}
            cy={centerY}
            fill="none"
            r={radius * fraction}
            stroke={RGB_THEME.border}
            strokeOpacity={fraction === 1 ? 0.9 : 0.48}
            strokeWidth={1}
          />
        ))}
        <Line
          stroke={RGB_THEME.border}
          strokeWidth={1}
          x1={centerX - radius}
          x2={centerX + radius}
          y1={centerY}
          y2={centerY}
        />
        <Line
          stroke={RGB_THEME.border}
          strokeWidth={1}
          x1={centerX}
          x2={centerX}
          y1={centerY - radius}
          y2={centerY + radius}
        />
        <SvgText
          fill={RGB_THEME.cyan}
          fontSize={12}
          fontWeight="700"
          textAnchor="middle"
          x={centerX}
          y={centerY - radius - 12}
        >
          N
        </SvgText>

        {target ? (
          <>
            <Line
              stroke={markerColor}
              strokeDasharray="5 6"
              strokeOpacity={0.72}
              strokeWidth={2}
              x1={centerX}
              x2={markerX}
              y1={centerY}
              y2={markerY}
            />
            <Circle
              cx={markerX}
              cy={markerY}
              fill={markerColor}
              r={18}
              stroke={RGB_THEME.text}
              strokeWidth={2}
            />
            <SvgText
              fill={RGB_THEME.surface}
              fontSize={20}
              fontWeight="900"
              textAnchor="middle"
              x={markerX}
              y={markerY + 7}
            >
              {melodyCollected ? "✓" : "♪"}
            </SvgText>
          </>
        ) : null}

        <Circle
          cx={centerX}
          cy={centerY}
          fill={RGB_THEME.text}
          r={7}
          stroke={RGB_THEME.cyan}
          strokeWidth={4}
        />
      </Svg>

      <View style={styles.readout}>
        <Text style={styles.mode}>PRIVATE GPS RADAR</Text>
        <Text style={styles.distance}>
          {target ? `${Math.round(distance)} m · ${Math.round(bearing)}°` : "No target"}
        </Text>
        <Text numberOfLines={1} style={styles.target}>
          {target?.name ?? "Finding a nearby signal"}
        </Text>
      </View>
    </View>
  );
}

function bearingDegrees(from: LatLng, to: LatLng) {
  const latitudeA = (from.latitude * Math.PI) / 180;
  const latitudeB = (to.latitude * Math.PI) / 180;
  const longitudeDelta = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(longitudeDelta) * Math.cos(latitudeB);
  const x =
    Math.cos(latitudeA) * Math.sin(latitudeB) -
    Math.sin(latitudeA) * Math.cos(latitudeB) * Math.cos(longitudeDelta);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: RGB_THEME.background,
  },
  readout: {
    left: 20,
    position: "absolute",
    right: 20,
    top: 24,
  },
  mode: { color: RGB_THEME.magenta, fontSize: 11, fontWeight: "900" },
  distance: {
    color: RGB_THEME.text,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4,
  },
  target: { color: RGB_THEME.muted, fontSize: 14, marginTop: 2 },
});
