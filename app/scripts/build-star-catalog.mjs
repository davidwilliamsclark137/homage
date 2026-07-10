import { readFile, writeFile } from "node:fs/promises";

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  throw new Error(
    "Usage: node scripts/build-star-catalog.mjs INPUT.tsv OUTPUT.json",
  );
}

const source = await readFile(inputPath, "utf8");
const lines = source.split(/\r?\n/);
const headerIndex = lines.findIndex((line) =>
  line.startsWith("HIP\tVmag\tHpmag\t"),
);

if (headerIndex < 0) {
  throw new Error("Hipparcos column header was not found.");
}

const stars = lines
  .slice(headerIndex + 3)
  .filter((line) => line.trim() && !line.startsWith("#"))
  .map((line) => {
    const [
      hipText,
      visualMagnitudeText,
      hipparcosMagnitudeText,
      raText,
      decText,
      colorText,
    ] =
      line.split("\t");
    const hip = Number(hipText);
    const visualMagnitude = visualMagnitudeText.trim()
      ? Number(visualMagnitudeText)
      : null;
    const hipparcosMagnitude = hipparcosMagnitudeText.trim()
      ? Number(hipparcosMagnitudeText)
      : null;
    const magnitude = visualMagnitude ?? hipparcosMagnitude;
    const rightAscension = Number(raText);
    const declination = Number(decText);
    const colorIndex = colorText.trim() ? Number(colorText) : null;

    if (
      !Number.isFinite(hip) ||
      !Number.isFinite(rightAscension) ||
      !Number.isFinite(declination)
    ) {
      throw new Error(`Invalid catalog row: ${line}`);
    }

    if (magnitude === null || !Number.isFinite(magnitude) || magnitude > 6.5) {
      return null;
    }

    return [
      hip,
      Number(rightAscension.toFixed(6)),
      Number(declination.toFixed(6)),
      Number(magnitude.toFixed(2)),
      colorIndex === null ? null : Number(colorIndex.toFixed(3)),
    ];
  })
  .filter((star) => star !== null);

if (stars.length < 8_000 || stars.length > 10_000) {
  throw new Error(`Unexpected naked-eye catalog size: ${stars.length}`);
}

const output = {
  source: "Hipparcos Main Catalogue I/239/hip_main (ESA 1997 via CDS VizieR)",
  query:
    "HIP,Vmag,Hpmag,RAICRS,DEICRS,B-V; Johnson V or fallback Hipparcos magnitude is at most 6.5",
  generatedAt: new Date().toISOString(),
  stars,
};

await writeFile(outputPath, `${JSON.stringify(output)}\n`);
console.log(`Wrote ${stars.length} stars to ${outputPath}`);
