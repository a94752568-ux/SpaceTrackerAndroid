/**
 * Tests del módulo de posición lunar (moon-position.ts).
 * Ejecutar: node --test scripts/moon-position.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { loadModule } from "./_load.mjs";

const { getMoonPosition } = await loadModule("/src/lib/space/moon-position.ts");

test("Moon position for current epoch is physically valid", () => {
  const moon = getMoonPosition(new Date("2026-10-18T12:00:00Z"));
  assert.ok(moon.distanceKm >= 350000 && moon.distanceKm <= 410000, `distancia fuera de rango: ${moon.distanceKm}`);
  assert.ok(moon.lat >= -30 && moon.lat <= 30, `latitud sub-lunar fuera de rango: ${moon.lat}`);
  assert.ok(moon.lon >= -180 && moon.lon <= 180, `longitud sub-lunar fuera de rango: ${moon.lon}`);
});

test("Moon position with observer calculates look angles", () => {
  // Madrid: 40.4168, -3.7038
  const moon = getMoonPosition(new Date("2026-10-18T22:00:00Z"), 40.4168, -3.7038);
  assert.ok(typeof moon.azimuth === "number" && moon.azimuth >= 0 && moon.azimuth < 360);
  assert.ok(typeof moon.elevation === "number" && moon.elevation >= -90 && moon.elevation <= 90);
  assert.equal(typeof moon.isAboveHorizon, "boolean");
});
