import assert from "node:assert/strict";
import { test } from "node:test";

import { detectClimbs, parseGPX, type TerrainPoint } from "../lib/terrain/gpx-parser";

/**
 * Test di lib/terrain/gpx-parser.ts (Modulo Profilo §33 C.6). Verificano la
 * geometria pura: segmentazione salite/discese, segno del gradiente,
 * categoria UCI-derived, course_character. Punti sintetici con
 * distFromStart_m espliciti (detectClimbs non ricalcola via Haversine).
 */

/** Costruisce punti a passo fisso lungo un profilo elevazione piecewise-lineare. */
function buildPoints(
  profile: Array<{ atM: number; ele: number }>,
  stepM = 25
): TerrainPoint[] {
  const points: TerrainPoint[] = [];
  const lastM = profile[profile.length - 1].atM;
  for (let d = 0; d <= lastM; d += stepM) {
    // Interpolazione lineare tra i due punti di controllo che racchiudono d.
    let seg = profile[0];
    let next = profile[1];
    for (let i = 0; i < profile.length - 1; i++) {
      if (d >= profile[i].atM && d <= profile[i + 1].atM) {
        seg = profile[i];
        next = profile[i + 1];
        break;
      }
    }
    const span = next.atM - seg.atM;
    const frac = span > 0 ? (d - seg.atM) / span : 0;
    const ele = seg.ele + (next.ele - seg.ele) * frac;
    points.push({ lat: 45 + d / 1_000_000, lon: 9, ele, distFromStart_m: d });
  }
  return points;
}

test("detectClimbs: salita centrale rilevata con gradiente positivo e categoria", () => {
  // Pianura -> salita 200m/2000m (10%) -> discesa 150m/1000m (-15%) -> pianura.
  const points = buildPoints([
    { atM: 0, ele: 500 },
    { atM: 1000, ele: 500 },
    { atM: 3000, ele: 700 },
    { atM: 4000, ele: 550 },
    { atM: 5000, ele: 550 },
  ]);
  const summary = detectClimbs(points);

  assert.equal(summary.descents.length, 1, "deve rilevare la discesa finale");
  assert.ok(summary.descents[0].avg_gradient_pct < 0, "il gradiente di discesa deve essere negativo");
  assert.ok(
    Math.abs(summary.descents[0].elevation_m - 150) <= 5,
    `elevation_m discesa attesa ~150, trovata ${summary.descents[0].elevation_m}`
  );

  assert.equal(
    summary.climbs.length,
    1,
    "deve rilevare la salita di 200m tra il primo e l'ultimo estremo: se fallisce, il tratto " +
      "iniziale (0→prima inversione) viene perso dalla segmentazione"
  );
});

test("detectClimbs: categoria UCI-derived per dislivello", () => {
  const points = buildPoints([
    { atM: 0, ele: 0 },
    { atM: 1000, ele: 0 },
    { atM: 6000, ele: 1100 }, // +1100m in 5000m → HC (margine sopra 1000)
    { atM: 7000, ele: 900 }, // discesa 200m, sotto la prossima salita
    { atM: 12000, ele: 1650 }, // +750m → Cat 1 (margine sopra 650)
  ]);
  const summary = detectClimbs(points);
  const categories = summary.climbs.map((c) => c.category);
  assert.ok(categories.includes("HC"), `categorie trovate: ${categories.join(",")}`);
  assert.ok(categories.includes("Cat 1"), `categorie trovate: ${categories.join(",")}`);
});

test("detectClimbs: kicker <100m escluso da climbs[]", () => {
  const points = buildPoints([
    { atM: 0, ele: 0 },
    { atM: 1000, ele: 0 },
    { atM: 1500, ele: 80 }, // +80m, sotto soglia 100m: kicker
    { atM: 2500, ele: 0 },
  ]);
  const summary = detectClimbs(points);
  assert.equal(summary.climbs.length, 0, "un dislivello <100m non deve generare una climb");
});

test("detectClimbs: course_character coerente con elevation_per_km", () => {
  const flat = buildPoints([
    { atM: 0, ele: 100 },
    { atM: 10_000, ele: 105 },
  ]);
  assert.equal(detectClimbs(flat).course_character, "flat");

  const mountain = buildPoints([
    { atM: 0, ele: 0 },
    { atM: 10_000, ele: 400 },
  ]);
  assert.equal(detectClimbs(mountain).course_character, "mountain");
});

test("detectClimbs: meno di 2 punti → terrain_summary vuoto, nessun crash", () => {
  const summary = detectClimbs([{ lat: 45, lon: 9, ele: 100, distFromStart_m: 0 }]);
  assert.equal(summary.climbs.length, 0);
  assert.equal(summary.descents.length, 0);
  assert.equal(summary.total_elevation_m, 0);
});

test("parseGPX: legge trkpt e calcola distanza/dislivello da XML reale", () => {
  const gpx = `<?xml version="1.0"?>
<gpx><trk><trkseg>
<trkpt lat="45.0000" lon="9.0000"><ele>500</ele></trkpt>
<trkpt lat="45.0010" lon="9.0000"><ele>520</ele></trkpt>
<trkpt lat="45.0020" lon="9.0000"><ele>540</ele></trkpt>
</trkseg></trk></gpx>`;
  const parsed = parseGPX(gpx);
  assert.equal(parsed.points.length, 3);
  assert.ok(parsed.total_distance_m > 0, "deve accumulare distanza via Haversine");
  assert.ok(parsed.total_elevation_m > 0, "deve accumulare dislivello positivo");
});

test("parseGPX: scarta punti senza elevazione valida", () => {
  const gpx = `<?xml version="1.0"?>
<gpx><trk><trkseg>
<trkpt lat="45.0000" lon="9.0000"><ele>500</ele></trkpt>
<trkpt lat="45.0010" lon="9.0000"></trkpt>
</trkseg></trk></gpx>`;
  const parsed = parseGPX(gpx);
  assert.equal(parsed.points.length, 1, "il punto senza ele valido va scartato");
});
