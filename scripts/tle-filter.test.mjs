/**
 * Tests del filtro estricto de TLEs obsoletos (tle-filter.ts):
 * umbral de caducidad 30 d, checksum, épocas, junk con bypass, viabilidad
 * orbital, decaimiento SGP4 y consistencia de stats del lote.
 *
 * Ejecutar: node --test scripts/tle-filter.test.mjs
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";

import { FIXTURES, breakChecksum, fixChecksum, patchEpoch } from "./_mocks.mjs";
import { closeVite, loadModule } from "./_load.mjs";

after(closeVite);

const F = await loadModule("/src/lib/space/tle-filter.ts");

const DAY = 86_400_000;
const NOW = new Date();
const BASE = FIXTURES[0];

const row = (f = BASE, over = {}) => ({
  ...f,
  id: f.id,
  name: f.name,
  line1: f.line1,
  line2: f.line2,
  ...over,
});

/** Línea 2 con movimiento medio sustituido (checksum corregido). */
function withMeanMotion(line2, mmText) {
  return fixChecksum(line2.slice(0, 52) + mmText.padStart(11, " ") + line2.slice(63));
}
/** Línea 2 con excentricidad sustituida (7 dígitos, checksum corregido). */
function withEcc(line2, eccDigits) {
  return fixChecksum(line2.slice(0, 26) + eccDigits + line2.slice(33));
}

test("umbral estricto por defecto: 30 días", () => {
  assert.equal(F.MAX_TLE_AGE_DAYS, 30);
});

test("TLE fresco pasa la puerta con bucket fresh", () => {
  const g = F.gateRow(row({ ...BASE, line1: patchEpoch(BASE.line1, NOW) }), { now: NOW });
  assert.equal(g.ok, true);
  assert.equal(g.bucket, "fresh");
});

test("caducidad: 29 d entra (stale), 31 d se DESCARTA (expired)", () => {
  const aged = (days) => row({ ...BASE, line1: patchEpoch(BASE.line1, new Date(NOW.getTime() - days * DAY)) });
  const ok = F.gateRow(aged(29), { now: NOW });
  assert.equal(ok.ok, true);
  assert.equal(ok.bucket, "stale");
  const ko = F.gateRow(aged(31), { now: NOW });
  assert.deepEqual(ko, { ok: false, reason: "epochExpired" });
});

test("maxAgeDays es configurable", () => {
  const aged60 = row({ ...BASE, line1: patchEpoch(BASE.line1, new Date(NOW.getTime() - 60 * DAY)) });
  assert.equal(F.gateRow(aged60, { now: NOW }).ok, false);
  const g = F.gateRow(aged60, { now: NOW, maxAgeDays: 90 });
  assert.equal(g.ok, true);
  assert.equal(g.bucket, "stale");
});

test("checksum roto => reason checksum", () => {
  const g = F.gateRow(row(BASE, { line2: breakChecksum(BASE.line2) }), { now: NOW });
  assert.deepEqual(g, { ok: false, reason: "checksum" });
});

test("época futura => reason epochFuture", () => {
  const fut = row({ ...BASE, line1: patchEpoch(BASE.line1, new Date(NOW.getTime() + 2 * DAY)) });
  assert.deepEqual(F.gateRow(fut, { now: NOW }), { ok: false, reason: "epochFuture" });
});

test("junk se descarta, salvo interés explícito por NORAD", () => {
  const debris = row(BASE, { name: "COSMOS 396 R/B" });
  assert.deepEqual(F.gateRow(debris, { now: NOW }), { ok: false, reason: "junk" });
  const bypass = F.gateRow(debris, { now: NOW, interest: new Set([BASE.id]) });
  assert.equal(bypass.ok, true, "la lista de interés bypasea el filtro junk");
});

test("órbita implausible: mov. medio 25 rev/d y ecc 0.95 se descartan", () => {
  const mm = row(BASE, { line2: withMeanMotion(BASE.line2, "25.00000000") });
  assert.deepEqual(F.gateRow(mm, { now: NOW }), { ok: false, reason: "implausible" });
  const ecc = row(BASE, { line2: withEcc(BASE.line2, "9500000") });
  assert.deepEqual(F.gateRow(ecc, { now: NOW }), { ok: false, reason: "implausible" });
  assert.equal(F.orbitPlausible("2 43010   0.0235 279.5137 0001769 106.9365  74.8048  1.00271561 13454".slice(0, 68) + "4"), true);
  assert.equal(F.orbitPlausible("2 43435  37.0084 356.4231 3699887 343.2516  18.7652  0.07300000 12345".slice(0, 68) + "4"), true);
});

test("decaimiento: stub inyectable y comprobación real en TLE fresco", () => {
  const fresh = row({ ...BASE, line1: patchEpoch(BASE.line1, NOW) });
  const stub = F.gateRow(fresh, { now: NOW, isDecayed: () => true });
  assert.deepEqual(stub, { ok: false, reason: "decayed" });
  assert.equal(F.isDecayedReal(fresh, NOW), false, "la ISS real no está decaída");
  assert.equal(F.gateRow(fresh, { now: NOW, decayCheck: false, isDecayed: () => true }).ok, true, "decayCheck=false desactiva");
});

test("filterActiveSatellites: activeSatellites limpio y stats cuadran", () => {
  const rows = [
    row(FIXTURES[0], { line1: patchEpoch(FIXTURES[0].line1, NOW) }),
    row(FIXTURES[1], { line1: patchEpoch(FIXTURES[1].line1, NOW) }),
    row(FIXTURES[2], { line2: breakChecksum(FIXTURES[2].line2) }),
    row(FIXTURES[3], { line1: patchEpoch(FIXTURES[3].line1, new Date(NOW.getTime() - 45 * DAY)) }),
    row(FIXTURES[4], { line1: patchEpoch(FIXTURES[4].line1, NOW), name: "DEB SL-16 R/B" }),
    row(FIXTURES[5], { line1: patchEpoch(FIXTURES[5].line1, NOW), source: "ivan" }),
  ];
  const { activeSatellites: sats, stats } = F.filterActiveSatellites(rows, { now: NOW });
  assert.equal(sats.length, 3, "solo vigentes en activeSatellites");
  assert.deepEqual(sats.map((s) => s.id), [FIXTURES[0].id, FIXTURES[1].id, FIXTURES[5].id]);
  assert.equal(stats.seen, 6);
  assert.equal(stats.valid, 3);
  assert.equal(stats.invalid, 1);
  assert.equal(stats.expired, 1);
  assert.equal(stats.junk, 1);
  assert.equal(stats.fresh + stats.aging + stats.stale, stats.valid);
  assert.equal(
    stats.seen,
    stats.valid + stats.invalid + stats.future + stats.expired + stats.junk + stats.implausible + stats.decayed,
    "invariante de auditoría seen = valid + Σ rechazos",
  );
  assert.equal(stats.bySource.ivan, 1);
  assert.equal(stats.seenBySource.ivan, 1);
});
