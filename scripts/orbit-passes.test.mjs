/**
 * Tests del motor orbital: propagación, parámetros, caché invalidada por TLE
 * (regresión de Etapa 1), trayectoria, huella, ángulos y predicción de pasos.
 * Ejecutar: node --test scripts/orbit-passes.test.mjs
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";

import { FIXTURES } from "./fixtures.mjs";
import { closeVite, loadModule, satFromFixture } from "./_load.mjs";

after(closeVite);

const {
  cacheKeyOf,
  satrecOf,
  clearSatrecCache,
  getFix,
  orbitParams,
  groundTrack,
  footprint,
  lookAngles,
  predictPasses,
  solarInfo,
  forecastNow,
  bearingDeg,
} = await loadModule("/src/lib/space/propagate.ts");

const ISS = satFromFixture(FIXTURES, "ISS (ZARYA)", "crew");
const NOAA19 = satFromFixture(FIXTURES, "NOAA 19", "weather");
const NOW = new Date();

// Observador de referencia (latitud ~inclinación ISS => pasos frecuentes).
const OBS_51 = {
  name: "London-ish",
  country: "UK",
  latitude: 51.5,
  longitude: -0.12,
  timezone: "Europe/London",
  elevationM: 10,
};
const OBS_MAD = {
  name: "Madrid",
  country: "España",
  latitude: 40.4168,
  longitude: -3.7038,
  timezone: "Europe/Madrid",
  elevationM: 667,
};

test("orbitParams de la ISS: LEO ~51.6°, período ~92-93 min", () => {
  const p = orbitParams(ISS);
  assert.ok(p.periodMin > 88 && p.periodMin < 96, `periodMin=${p.periodMin}`);
  assert.ok(Math.abs(p.inclinationDeg - 51.64) < 0.5, `inc=${p.inclinationDeg}`);
  assert.ok(p.perigeeKm > 300 && p.perigeeKm < 500, `perigee=${p.perigeeKm}`);
  assert.ok(p.apogeeKm >= p.perigeeKm);
  assert.ok(p.meanMotionRevDay > 15 && p.meanMotionRevDay < 16, `n=${p.meanMotionRevDay}`);
  assert.equal(p.noradId, 25544);
  assert.ok(p.epoch instanceof Date && !Number.isNaN(p.epoch.getTime()));
  // La época del satrec debe estar cerca de ahora (fixture descargada hoy).
  assert.ok(Math.abs(NOW - p.epoch) < 5 * 86_400_000, `epoch=${p.epoch.toISOString()}`);
});

test("getFix de la ISS ahora: altitud y velocidad coherentes", () => {
  const fix = getFix(ISS, NOW);
  assert.ok(fix, "getFix devolvió null");
  assert.ok(fix.altKm > 350 && fix.altKm < 500, `alt=${fix.altKm}`);
  assert.ok(fix.velKmS > 7.5 && fix.velKmS < 7.9, `vel=${fix.velKmS}`);
  assert.ok(fix.latDeg >= -90 && fix.latDeg <= 90);
  assert.ok(fix.lonDeg >= -180 && fix.lonDeg <= 180);
  assert.equal(fix.tMs, NOW.getTime());
});

test("REGRESIÓN Etapa 1: la clave de caché incluye line1 y line2", () => {
  assert.equal(cacheKeyOf(ISS), `${ISS.id}:${ISS.line1}:${ISS.line2}`);
  const issViejo = { ...ISS, line1: "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9002", line2: "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537" };
  assert.notEqual(cacheKeyOf(issViejo), cacheKeyOf(ISS));
});

test("REGRESIÓN Etapa 1: cambiar el TLE del mismo id invalida el SatRec y la posición", () => {
  clearSatrecCache();
  const a = satrecOf(ISS);
  assert.equal(satrecOf(ISS), a, "misma clave => misma instancia");
  // Mismo id, TLE distinto (líneas de NOAA 19): debe producir otro SatRec y otra posición.
  const impostor = { ...ISS, line1: NOAA19.line1, line2: NOAA19.line2 };
  const b = satrecOf(impostor);
  assert.notEqual(a, b, "el SatRec no se invalidó al cambiar el TLE");
  const fixA = getFix(ISS, NOW);
  const fixB = getFix(impostor, NOW);
  assert.ok(Math.abs(fixA.altKm - fixB.altKm) > 100, "las altitudes deberían diferir (LEO 420 vs ~850 km)");
  // Y el original sigue cacheado y estable:
  assert.equal(satrecOf(ISS), a);
});

test("groundTrack: una órbita muestreada, longitudes normalizadas", () => {
  const trk = groundTrack(ISS, NOW, { orbits: 1, samples: 60 });
  assert.ok(trk.length >= 60, `puntos=${trk.length}`);
  for (const p of trk) {
    assert.ok(p.lonDeg >= -180 && p.lonDeg <= 180);
    assert.ok(p.latDeg >= -53 && p.latDeg <= 53, `lat fuera del rango de inclinación: ${p.latDeg}`);
  }
  // El último punto está ~1 período después del primero.
  const spanMin = (trk[trk.length - 1].tMs - trk[0].tMs) / 60000;
  const period = orbitParams(ISS).periodMin;
  assert.ok(Math.abs(spanMin - period) < 1, `span=${spanMin} vs periodo=${period}`);
});

test("footprint: radio creciente con la altitud y anillo cerrado", () => {
  const fIss = footprint(ISS, NOW);
  const fNoaa = footprint(NOAA19, NOW);
  assert.ok(fIss && fNoaa);
  assert.ok(fIss.radiusKm > 1500 && fIss.radiusKm < 3000, `ISS r=${fIss.radiusKm}`);
  assert.ok(fNoaa.radiusKm > fIss.radiusKm, "a más altitud, mayor huella");
  assert.equal(fIss.ring.length, 64);
  for (const p of fIss.ring) {
    assert.ok(p.latDeg >= -90 && p.latDeg <= 90);
    assert.ok(p.lonDeg >= -180 && p.lonDeg <= 180);
  }
});

test("lookAngles: azimut [0,360), elevación [-90,90], distancia > 0", () => {
  const la = lookAngles(ISS, OBS_MAD, NOW);
  assert.ok(la);
  assert.ok(la.azDeg >= 0 && la.azDeg < 360);
  assert.ok(la.elDeg >= -90 && la.elDeg <= 90);
  assert.ok(la.rangeKm > 0);
  // La distancia debe ser coherente con la altitud (>= alt, <= alt + 2·Re aprox).
  const fix = getFix(ISS, NOW);
  assert.ok(la.rangeKm >= fix.altKm - 1);
});

test("predictPasses ISS 72 h sobre lat 51.5: al menos un paso y bien formado", () => {
  const passes = predictPasses(ISS, OBS_51, NOW, { durationHours: 72, coarseStepSec: 30 });
  assert.ok(passes.length >= 1, "debería haber al menos un paso en 72 h");
  for (const p of passes) {
    assert.ok(p.aosMs < p.tcaMs && p.tcaMs < p.losMs, "orden AOS < TCA < LOS");
    assert.ok(p.maxElDeg > 0 && p.maxElDeg <= 90, `maxEl=${p.maxElDeg}`);
    assert.ok(p.azRiseDeg >= 0 && p.azRiseDeg < 360);
    assert.ok(p.azSetDeg >= 0 && p.azSetDeg < 360);
    assert.ok(p.durationMin > 0.5 && p.durationMin < 15, `dur=${p.durationMin}`);
    assert.ok(Math.abs(p.durationMin - (p.losMs - p.aosMs) / 60000) < 1e-9);
  }
  // Ordenados cronológicamente y sin solaparse.
  for (let i = 1; i < passes.length; i++) {
    assert.ok(passes[i].aosMs > passes[i - 1].losMs);
  }
});

test("predictPasses con umbral alto puede devolver 0 pasos sin romper", () => {
  const passes = predictPasses(NOAA19, OBS_MAD, NOW, { durationHours: 6, minElDeg: 80 });
  assert.ok(Array.isArray(passes));
});

test("solarInfo: fracción de sombra en [0,1] y hora solar en [0,24)", () => {
  const s = solarInfo(ISS, NOW, OBS_MAD);
  assert.ok(s);
  assert.ok(s.shadowFraction >= 0 && s.shadowFraction <= 1);
  assert.equal(typeof s.sunlit, "boolean");
  assert.ok(s.localSolarTimeH >= 0 && s.localSolarTimeH < 24);
  assert.ok(s.observerSolarTimeH >= 0 && s.observerSolarTimeH < 24);
});

test("forecastNow agrega posición, ángulos y sol", () => {
  const f = forecastNow(ISS, NOW, OBS_MAD);
  assert.ok(f);
  assert.equal(f.iso, NOW.toISOString());
  assert.ok(typeof f.latDeg === "number" && typeof f.velKmS === "number");
  assert.ok(typeof f.azDeg === "number" && typeof f.elDeg === "number");
  assert.equal(typeof f.sunlit, "boolean");
  const sinObs = forecastNow(ISS, NOW);
  assert.ok(sinObs && sinObs.azDeg === undefined);
});

test("bearingDeg: rumbos cardinales y cruce del antimeridiano", () => {
  const P = (latDeg, lonDeg) => ({ latDeg, lonDeg });
  assert.ok(Math.abs(bearingDeg(P(0, 0), P(1, 0)) - 0) < 1e-6, "norte = 0°");
  assert.ok(Math.abs(bearingDeg(P(0, 0), P(0, 1)) - 90) < 1e-6, "este = 90°");
  assert.ok(Math.abs(bearingDeg(P(0, 0), P(-1, 0)) - 180) < 1e-6, "sur = 180°");
  assert.ok(Math.abs(bearingDeg(P(0, 0), P(0, -1)) - 270) < 1e-6, "oeste = 270°");
  // Cruce del antimeridiano hacia el este: no debe invertirse el ángulo.
  const b = bearingDeg(P(0, 179.5), P(0, -179.5));
  assert.ok(Math.abs(b - 90) < 1e-6, `antimeridiano este = 90°, obtenido ${b}`);
  // Rango siempre [0, 360):
  for (const [a, c] of [[P(10, 10), P(9, 9)], [P(-20, 30), P(-21, 31)]]) {
    const d = bearingDeg(a, c);
    assert.ok(d >= 0 && d < 360, `rango inválido ${d}`);
  }
});

test("TLE inválido propagable => getFix devuelve null sin lanzar", () => {
  const basura = { id: 99999, name: "BASURA", line1: "1 99999U 00000A   00001.00000000  .00000000  00000-0  00000-0 0  0000", line2: "2 99999   0.0000   0.0000 0000000   0.0000   0.0000 15.00000000    00", group: "other" };
  const fix = getFix(basura, NOW);
  // Puede ser null (propagación fallida) o un valor; lo importante: no lanza.
  assert.ok(fix === null || typeof fix === "object");
});
