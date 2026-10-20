/**
 * Tests del núcleo de cálculo de flota (el mismo código que ejecuta el Web
 * Worker): empaquetado STRIDE=6, banderas ok y coherencia con propagate.getFix.
 * Ejecutar: node --test scripts/fleet-compute.test.mjs
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";

import { FIXTURES } from "./fixtures.mjs";
import { closeVite, loadModule } from "./_load.mjs";

after(closeVite);

const { computeFleet, idsOf, FLEET_STRIDE, FLEET_UPDATE_MS } = await loadModule(
  "/src/lib/space/fleet-compute.ts",
);
const { getFix } = await loadModule("/src/lib/space/propagate.ts");

const T = Date.UTC(2026, 9, 18, 12, 0, 0);
const GOOD = ["ISS (ZARYA)", "NOAA 19", "GOES 18", "TERRA", "AQUA"];
const FLEET = FIXTURES.filter((f) => GOOD.includes(f.name)).map((f) => ({
  id: f.id,
  line1: f.line1,
  line2: f.line2,
}));

test("throttling de flota: 2 s (dentro del rango pedido 1-2 s)", () => {
  assert.ok(FLEET_UPDATE_MS >= 1000 && FLEET_UPDATE_MS <= 2000, `FLEET_UPDATE_MS=${FLEET_UPDATE_MS}`);
});

test("empaquetado: STRIDE=6 por satélite y flag ok", () => {
  const data = computeFleet(FLEET, T);
  assert.equal(data.length, FLEET.length * FLEET_STRIDE);
  for (let i = 0; i < FLEET.length; i++) {
    assert.equal(data[i * FLEET_STRIDE + 5], 1, `sat ${FLEET[i].id} debe propagar`);
  }
  assert.deepEqual([...idsOf(FLEET)], FLEET.map((f) => f.id));
});

test("TLE real degradado (STARLINK-2342, época ~70 d, SGP4 error 1) => ok=0", () => {
  // TLE real capturado el 2026-10-18 desde SatNOGS; SGP4 lo rechaza
  // (MeanEccentricityOutOfRange). Las fixtures actuales ya excluyen TLEs que
  // no propagan, así que se conserva aquí como constante de regresión.
  const DEGRADED = {
    id: 47883,
    line1: "1 47883U 21021Z   26221.29382532  .10265833  12504-4  34182-3 0  9998",
    line2: "2 47883  53.1310 236.0585 0005207 288.2631  71.7852 16.44437377300388",
  };
  const data = computeFleet([DEGRADED], T);
  assert.equal(data[5], 0, "el worker marca ok=0 y el canvas lo oculta");
});

test("coherencia con propagate.getFix (mismo TLE, mismo instante)", () => {
  const data = computeFleet([FLEET[0]], T);
  const fix = getFix(
    { id: FLEET[0].id, name: "x", line1: FLEET[0].line1, line2: FLEET[0].line2, group: "other" },
    new Date(T),
  );
  assert.ok(fix);
  assert.ok(Math.abs(data[0] - fix.latDeg) < 1e-9, "lat");
  assert.ok(Math.abs(data[1] - fix.lonDeg) < 1e-9, "lon");
  assert.ok(Math.abs(data[2] - fix.altKm) < 1e-9, "alt");
  assert.ok(Math.abs(data[3] - fix.velKmS) < 1e-9, "vel");
  assert.ok(data[4] >= 0 && data[4] < 360, `bearing ${data[4]}`);
});

test("valores físicos plausibles para LEO", () => {
  const data = computeFleet(FLEET, T);
  for (let i = 0; i < FLEET.length; i++) {
    const o = i * FLEET_STRIDE;
    assert.ok(data[o] >= -90 && data[o] <= 90, "lat rango");
    assert.ok(data[o + 1] >= -180 && data[o + 1] <= 180, "lon rango");
    assert.ok(data[o + 2] > 200 && data[o + 2] < 40000, `alt ${data[o + 2]}`);
    assert.ok(data[o + 3] > 2.5 && data[o + 3] < 8.5, `vel ${data[o + 3]}`);
  }
});

test("TLE estructuralmente inválido para SGP4 (e≈1) => ok=0 y ceros", () => {
  // excentricidad 0.9999999 → sgp4init falla (error 4: semi-latus rectum < 0)
  const l1 = "1 99999U 00000A   26290.50000000  .00000000  00000+0  00000+0 0  9990";
  const l2 = "2 99999  97.0000 100.0000 9999999   0.0000   0.0000 15.00000000    00";
  const cs = (l) => {
    let s = 0;
    for (let i = 0; i < l.length - 1; i++) {
      const c = l[i];
      if (c >= "0" && c <= "9") s += Number(c);
      else if (c === "-") s += 1;
    }
    return l.slice(0, 68) + String(s % 10);
  };
  const bad = [{ id: 99999, line1: cs(l1), line2: cs(l2) }];
  const data = computeFleet(bad, T);
  assert.equal(data[5], 0);
  assert.equal(data[0], 0);
  assert.equal(data[2], 0);
});
