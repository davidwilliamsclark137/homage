import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon, Polyline, Circle, Text as Label } from 'react-native-svg';
import data from './downtown.json';
import { Fix, PORTALS } from './engine';
const x = (v: number) => 200 + v,
  y = (v: number) => 215 + v;
export default function DowntownMap({
  fix,
  index,
  revealed,
}: {
  fix: Fix | null;
  index: number;
  revealed: boolean;
}) {
  const project = (lat: number, lon: number) => [
    x((lon - data.origin[0]) * 111320 * Math.cos((data.origin[1] * Math.PI) / 180)),
    y(-(lat - data.origin[1]) * 111320),
  ];
  const user = fix ? project(fix.latitude, fix.longitude) : null;
  return (
    <View
      style={styles.frame}
      accessibilityLabel="North-up map of downtown McKinney. Only the current discoverable portal is marked."
    >
      <Svg width="100%" height={300} viewBox="0 0 400 430">
        {data.roads.map((r, i) => (
          <Polyline
            key={'r' + i}
            points={r.points.map((p) => `${x(p[0])},${y(p[1])}`).join(' ')}
            stroke="#fffdf5"
            strokeWidth={r.type === 'footway' || r.type === 'path' ? 3 : 12}
            fill="none"
          />
        ))}
        {data.buildings.flatMap((rings, i) =>
          rings.map((r, j) => (
            <Polygon
              key={`${i}-${j}`}
              points={r.map((p) => `${x(p[0])},${y(p[1])}`).join(' ')}
              fill="#c6cec1"
              stroke="#b5bfae"
              strokeWidth={1}
            />
          )),
        )}
        <Label x={200} y={210} fontSize={12} textAnchor="middle" fill="#364d3e">
          MPAC
        </Label>
        {PORTALS.map((p, i) => {
          if (i > index || (i === index && p.hidden && !revealed)) return null;
          const [px, py] = project(p.latitude, p.longitude);
          return (
            <React.Fragment key={p.id}>
              <Circle
                cx={px}
                cy={py}
                r={i < index ? 9 : 14}
                fill={i < index ? '#718779' : '#205a40'}
                stroke="white"
                strokeWidth={3}
              />
              <Label x={px} y={py + 4} fill="white" textAnchor="middle" fontSize={11}>
                {i + 1}
              </Label>
            </React.Fragment>
          );
        })}
        {user && user[0] > 0 && user[0] < 400 && user[1] > 0 && user[1] < 430 && (
          <Circle
            cx={user[0]}
            cy={user[1]}
            r={7}
            fill="#246aca"
            stroke="white"
            strokeWidth={3}
          />
        )}
        <Label x={370} y={25} fill="#364d3e" fontSize={14}>
          N ↑
        </Label>
      </Svg>
      <Text style={styles.caption}>
        Downtown McKinney · blue is you · green is your portal
      </Text>
      <Text style={styles.caption}>
        Schematic map · follow sidewalks and marked crossings
      </Text>
      <Text style={styles.caption}>© OpenStreetMap contributors · ODbL</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  frame: { backgroundColor: '#e7ebdf', borderRadius: 22, overflow: 'hidden' },
  caption: { fontSize: 11, color: '#455c4b', textAlign: 'center', paddingBottom: 8 },
});
