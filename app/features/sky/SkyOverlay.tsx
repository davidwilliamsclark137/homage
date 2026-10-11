import React from "react";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";

import { Constellation, ProjectedStar } from "@mckinney/star-engine";

export type ProjectedConstellation = {
  constellation: Constellation;
  stars: ProjectedStar[];
};

export function SkyOverlay({
  layers,
  skyStars,
  selectedId,
  showStarNames,
  starBoost,
  width,
  height,
}: {
  layers: ProjectedConstellation[];
  skyStars: ProjectedStar[];
  selectedId: string;
  showStarNames: boolean;
  starBoost: number;
  width: number;
  height: number;
}) {
  const visibleSkyStars = skyStars.filter(
    (star) => star.onScreen && star.altitude > 0,
  );

  return (
    <Svg
      pointerEvents="none"
      width={width}
      height={height}
      style={{ position: "absolute", left: 0, top: 0 }}
    >
      {visibleSkyStars.map((star) => {
        const magnitude = extinctedMagnitude(star);
        const brightness = Math.max(0, Math.min(1, (6.8 - magnitude) / 7.2));
        const radius = 0.75 + Math.pow(brightness, 1.45) * 3.2;

        return (
          <Circle
            key={star.id}
            cx={star.x}
            cy={star.y}
            r={radius}
            fill={starColor(star.colorIndex)}
            fillOpacity={Math.min(1, (0.24 + brightness * 0.76) * starBoost)}
          />
        );
      })}

      {layers.map(({ constellation, stars }) => {
        const selected = constellation.id === selectedId;
        const byId = new Map(stars.map((star) => [star.id, star]));
        const onScreen = stars.filter((star) => star.onScreen);
        const labelX =
          onScreen.reduce((sum, star) => sum + star.x, 0) /
          Math.max(1, onScreen.length);
        const labelY =
          onScreen.reduce((sum, star) => sum + star.y, 0) /
          Math.max(1, onScreen.length);
        const color = selected ? "#67e8f9" : "#fbbf24";

        return (
          <React.Fragment key={constellation.id}>
            {constellation.segments.map(([fromId, toId]) => {
              const from = byId.get(fromId);
              const to = byId.get(toId);
              if (
                !from?.inFront ||
                !to?.inFront ||
                (!from.onScreen && !to.onScreen)
              ) {
                return null;
              }

              return (
                <Line
                  key={`${constellation.id}-${fromId}-${toId}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={color}
                  strokeOpacity={selected ? 0.96 : 0.72}
                  strokeWidth={selected ? 2.5 : 1.5}
                />
              );
            })}

            {onScreen.map((star) => {
              const radius = Math.max(2.5, 6.5 - star.magnitude);
              return (
                <Circle
                  key={`${constellation.id}-${star.id}`}
                  cx={star.x}
                  cy={star.y}
                  r={radius}
                  fill="#ffffff"
                  stroke={color}
                  strokeWidth={selected ? 2 : 1.25}
                />
              );
            })}

            {onScreen.length > 0 && (
              <SvgText
                x={labelX}
                y={labelY - 16}
                fill={color}
                fontSize={selected ? 16 : 13}
                fontWeight="700"
                textAnchor="middle"
              >
                {constellation.name}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}

      {showStarNames &&
        layers
          .find(({ constellation }) => constellation.id === selectedId)
          ?.stars.filter((star) => star.onScreen && star.magnitude < 2)
          .map((star) => (
            <SvgText
              key={`${star.id}-label`}
              x={star.x + 9}
              y={star.y - 8}
              fill="#ffffff"
              fontSize={12}
            >
              {star.name}
            </SvgText>
          ))}

      <Line
        x1={width / 2 - 12}
        y1={height / 2}
        x2={width / 2 + 12}
        y2={height / 2}
        stroke="#f8fafc"
        strokeWidth={1}
      />
      <Line
        x1={width / 2}
        y1={height / 2 - 12}
        x2={width / 2}
        y2={height / 2 + 12}
        stroke="#f8fafc"
        strokeWidth={1}
      />
    </Svg>
  );
}

function extinctedMagnitude(star: ProjectedStar) {
  if (star.altitude <= 0) return Number.POSITIVE_INFINITY;
  const altitude = Math.max(0.5, star.altitude);
  const radians = (altitude * Math.PI) / 180;
  const airMass =
    1 / (Math.sin(radians) + 0.50572 * Math.pow(altitude + 6.07995, -1.6364));
  return star.magnitude + 0.18 * Math.max(0, airMass - 1);
}

function starColor(colorIndex: number | null | undefined) {
  if (colorIndex === null || colorIndex === undefined) return "#f8fafc";
  if (colorIndex < -0.05) return "#a8c7ff";
  if (colorIndex < 0.35) return "#dbeafe";
  if (colorIndex < 0.8) return "#fffdf4";
  if (colorIndex < 1.25) return "#ffe7b0";
  return "#ffc078";
}
