/**
 * Tests de diagnóstico de época TLE (fresh/aging/stale/future/invalid).
 * Ejecutar: node --test scripts/tle-epoch.test.mjs
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";

import { FIXTURES } from "./fixtures.mjs";
import { closeVite, loadModule } from "./_load.mjs";

after(closeVite);

const {
  diagnoseTleEpoch,
  hasValidTleEpoch,
  expandEpochYear,
  isLeapYear,
  daysInYear,
  FRESH_MAX_DAYS,
  AGING_MAX_DAYS,
} = await loadModule("/src/lib/space/tle-epoch.ts");

const BASE = FIXTURES[0].line1;

/** Sustituye el campo de época (columnas 19-32) de una línea 1 real. */
function makeLine1(yy, doyText) {
  const field = String(yy).padStart(2, "0") + String(doyText).padEnd(12, "0").slice(0, 12);
  return BASE.slice(0, 18) + field + BASE.slice(32);
}

/** Campos de época (yy, doy fraccional) correspondientes a una fecha Date. */
function epochFields(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const doy = (date.getTime() - start) / 86_400_000 + 1;
  return { yy: date.getUTCFullYear() % 100, doy: doy.toFixed(8) };
}

function line1ForDate(date) {
  const f = epochFields(date);
  return makeLine1(f.yy, f.doy);
}

const DAY = 86_400_000;
const NOW = new Date();

test("ventana de siglo: 57-99 => 19xx; 00-56 => 20xx", () => {
  assert.equal(expandEpochYear(57), 1957);
  assert.equal(expandEpochYear(99), 1999);
  assert.equal(expandEpochYear(0), 2000);
  assert.equal(expandEpochYear(56), 2056);
});

test("bisiestos y días del año", () => {
  assert.equal(isLeapYear(2024), true);
  assert.equal(isLeapYear(2025), false);
  assert.equal(isLeapYear(2000), true);
  assert.equal(isLeapYear(1900), false);
  assert.equal(daysInYear(2024), 366);
  assert.equal(daysInYear(2025), 365);
});

test("época = ahora => fresh con edad ~0", () => {
  const d = diagnoseTleEpoch(line1ForDate(NOW), NOW);
  assert.equal(d.status, "fresh");
  assert.ok(Math.abs(d.ageDays) < 1e-6);
  assert.equal(FRESH_MAX_DAYS, 3);
  assert.equal(AGING_MAX_DAYS, 14);
});

test("fronteras fresh/aging/stale", () => {
  const exact = (msAgo) => diagnoseTleEpoch(line1ForDate(new Date(NOW.getTime() - msAgo)), NOW);
  assert.equal(exact(3 * DAY).status, "fresh"); // justo 3 días
  assert.equal(exact(3 * DAY + 3_600_000).status, "aging"); // 3 días + 1 h
  assert.equal(exact(14 * DAY).status, "aging"); // justo 14 días
  assert.equal(exact(14 * DAY + 3_600_000).status, "stale"); // 14 días + 1 h
});

test("época futura => future (y la ingesta la rechaza)", () => {
  const d = diagnoseTleEpoch(line1ForDate(new Date(NOW.getTime() + 2 * DAY)), NOW);
  assert.equal(d.status, "future");
  assert.ok(d.ageDays < 0);
  assert.ok(/futura/i.test(d.reason ?? ""));
  assert.equal(hasValidTleEpoch(line1ForDate(new Date(NOW.getTime() + 2 * DAY)), NOW), false);
});

test("día de época ilegal => invalid", () => {
  assert.equal(diagnoseTleEpoch(makeLine1(26, "0.5"), NOW).status, "invalid"); // día 0
  assert.equal(diagnoseTleEpoch(makeLine1(26, "367.0"), NOW).status, "invalid"); // > 366
  assert.equal(diagnoseTleEpoch(makeLine1(25, "366.0"), NOW).status, "invalid"); // 2025 no es bisiesto
});

test("día 366 en año bisiesto => válido", () => {
  const d = diagnoseTleEpoch(makeLine1(24, "366.0"), NOW); // 2024 sí es bisiesto
  assert.equal(d.status, "stale"); // 31-dic-2024 queda en el pasado
  assert.equal(d.epochYear, 2024);
});

test("línea ilegible => invalid", () => {
  assert.equal(diagnoseTleEpoch("1 25544U", NOW).status, "invalid");
  assert.equal(diagnoseTleEpoch("no es un TLE en absoluto, basura basura basura", NOW).status, "invalid");
});

test("hasValidTleEpoch acepta fresh/aging/stale y rechaza future/invalid", () => {
  assert.equal(hasValidTleEpoch(line1ForDate(NOW), NOW), true);
  assert.equal(hasValidTleEpoch(line1ForDate(new Date(NOW.getTime() - 10 * DAY)), NOW), true);
  assert.equal(hasValidTleEpoch(line1ForDate(new Date(NOW.getTime() - 30 * DAY)), NOW), true);
  assert.equal(hasValidTleEpoch(line1ForDate(new Date(NOW.getTime() + 1 * DAY)), NOW), false);
  assert.equal(hasValidTleEpoch(makeLine1(26, "999.0"), NOW), false);
});

test("las fixtures descargadas hoy tienen época válida y no futura", () => {
  for (const f of FIXTURES) {
    const d = diagnoseTleEpoch(f.line1, NOW);
    assert.ok(
      ["fresh", "aging", "stale"].includes(d.status),
      `${f.name}: status=${d.status} reason=${d.reason ?? "-"}`,
    );
    assert.ok(d.epochYear >= 2020, `${f.name}: epochYear=${d.epochYear}`);
  }
});
