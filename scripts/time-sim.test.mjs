/**
 * Tests de los helpers puros del control de tiempo (simulación SGP4).
 * Ejecutar: node --test scripts/time-sim.test.mjs
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";

import { closeVite, loadModule } from "./_load.mjs";

after(closeVite);

const T = await loadModule("/src/lib/ui/timecontrol.ts");

const HOUR = 3_600_000;
const REAL = Date.UTC(2026, 9, 18, 12, 0, 0);

test("ventana del slider: ±24 h en minutos", () => {
  assert.equal(T.RANGE_H, 24);
  assert.equal(T.RANGE_MIN, 1440);
});

test("offsetMinutes: redondea a minutos y acota a la ventana", () => {
  assert.equal(T.offsetMinutes(REAL, REAL), 0);
  assert.equal(T.offsetMinutes(REAL + 90 * 60000, REAL), 90);
  assert.equal(T.offsetMinutes(REAL - 2 * HOUR, REAL), -120);
  assert.equal(T.offsetMinutes(REAL + 72 * HOUR, REAL), 1440, "acota por arriba");
  assert.equal(T.offsetMinutes(REAL - 72 * HOUR, REAL), -1440, "acota por abajo");
  assert.equal(T.offsetMinutes(REAL + 30_000, REAL), 1, "redondeo 30 s → 1 min");
  assert.equal(T.offsetMinutes(REAL + 29_000, REAL), 0, "redondeo 29 s → 0 min");
});

test("shiftMs: ±1 h exacto y acumulable", () => {
  assert.equal(T.shiftMs(REAL, 1), REAL + HOUR);
  assert.equal(T.shiftMs(REAL, -1), REAL - HOUR);
  assert.equal(T.shiftMs(T.shiftMs(REAL, 1), -2), REAL - HOUR);
});

test("labelOffset: formato legible con signo", () => {
  assert.equal(T.labelOffset(0), "0h");
  assert.equal(T.labelOffset(HOUR), "+1h");
  assert.equal(T.labelOffset(-2 * HOUR), "-2h");
  assert.equal(T.labelOffset(1.5 * HOUR), "+1.5h");
  assert.equal(T.labelOffset(-0.5 * HOUR), "-0.5h");
});
