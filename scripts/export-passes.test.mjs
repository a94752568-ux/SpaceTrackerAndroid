/**
 * Tests del exportador de pases a CSV (parte pura).
 * Ejecutar: node --test scripts/export-passes.test.mjs
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";

import { closeVite, loadModule } from "./_load.mjs";

after(closeVite);

const { buildPassesCsv, passesFilename, PASSES_CSV_HEADER } = await loadModule(
  "/src/lib/ui/export-passes.ts",
);

const SAT = { id: 25544, name: 'ISS (ZARYA), "estación"', line1: "a", line2: "b", group: "crew" };
const OBS = { name: "La Paz, Bolivia", latitude: -16.5, longitude: -68.15, timezone: "America/La_Paz" };
const PASSES = [
  { aosMs: 1000, tcaMs: 2000, losMs: 3000, maxElDeg: 45.67, azRiseDeg: 300.1, azSetDeg: 60.2, durationMin: 6.5 },
  { aosMs: 9000, tcaMs: 10000, losMs: 11000, maxElDeg: 12, azRiseDeg: 45, azSetDeg: 315, durationMin: 4.25 },
];
const GEN = new Date(Date.UTC(2026, 9, 18, 12, 0, 0));

test("CSV: metadatos, cabecera y una fila por pase", () => {
  const csv = buildPassesCsv(SAT, OBS, PASSES, GEN);
  const lines = csv.trim().split("\n");
  assert.match(lines[0], /^# SpaceTracker · pases 24 h · generado 2026-10-18T12:00:00/);
  assert.equal(lines[1], PASSES_CSV_HEADER);
  assert.equal(lines.length, 2 + PASSES.length);
});

test("CSV: campos con comas/comillas se entrecomillan (RFC 4180)", () => {
  const csv = buildPassesCsv(SAT, OBS, PASSES, GEN);
  const row = csv.trim().split("\n")[2];
  assert.ok(row.startsWith('"ISS (ZARYA), ""estación""',), `fila: ${row}`);
  assert.ok(row.includes('"La Paz, Bolivia"'));
  assert.ok(row.includes("1970-01-01T00:00:01.000Z"), "AOS en ISO UTC");
  assert.ok(row.endsWith("6.50"), "duración con 2 decimales");
});

test("CSV sin pases: solo metadatos y cabecera", () => {
  const csv = buildPassesCsv(SAT, OBS, [], GEN);
  assert.equal(csv.trim().split("\n").length, 2);
});

test("nombre de archivo estable y seguro", () => {
  assert.equal(passesFilename(SAT, GEN), "spacetracker_pases_25544_2026-10-18.csv");
});
