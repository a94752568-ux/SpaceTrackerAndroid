/**
 * Motor orbital sobre satellite.js v7 (API verificada contra los .d.ts de 7.1.0).
 *
 * Responsabilidades:
 * - Caché de `SatRec` invalidada al cambiar el TLE (clave `${id}:${line1}:${line2}`) — Etapa 1.
 * - Posición geodésica (`Fix`), parámetros orbitales, trayectoria terrestre, huella.
 * - Ángulos observador (azimut/elevación/distancia), predicción de pasos.
 * - Información solar (iluminación y hora solar local en el punto subsatelital).
 *
 * Unidades expuestas: grados, km, km/s, ms epoch. Internamente satellite.js usa radianes.
 */

import {
  constants,
  degreesLat,
  degreesLong,
  degreesToRadians,
  eciToEcf,
  eciToGeodetic,
  ecfToLookAngles,
  gstime,
  invjday,
  jday,
  propagate as sgp4Propagate,
  radiansToDegrees,
  SatRecError,
  shadowFraction,
  sunPos,
  twoline2satrec,
} from "satellite.js";
import type { Fix, ForecastNow, Observer, Pass, Sat } from "./types";

/**
 * Tipo SatRec derivado de la propia librería: el paquete solo expone "." en su
 * mapa de exports, así que no se puede importar en profundidad
 * ("satellite.js/dist/…" fallaría con moduleResolution bundler).
 */
type SatRec = ReturnType<typeof twoline2satrec>;

/* ------------------------------------------------------------------ caché */

const satrecCache = new Map<string, SatRec>();
const CACHE_LIMIT = 8192;

/** Clave de caché: incluye las dos líneas TLE para invalidar al cambiar el TLE (Etapa 1). */
export function cacheKeyOf(sat: Sat): string {
  return `${sat.id}:${sat.line1}:${sat.line2}`;
}

export function satrecOf(sat: Sat): SatRec {
  const key = cacheKeyOf(sat);
  let rec = satrecCache.get(key);
  if (!rec) {
    rec = twoline2satrec(sat.line1, sat.line2);
    if (satrecCache.size >= CACHE_LIMIT) satrecCache.clear();
    satrecCache.set(key, rec);
  }
  return rec;
}

/** Solo para pruebas: vacía la caché. */
export function clearSatrecCache(): void {
  satrecCache.clear();
}

/* -------------------------------------------------------------- posición */

function normLonDeg(lon: number): number {
  let l = lon % 360;
  if (l > 180) l -= 360;
  if (l < -180) l += 360;
  return l;
}

/** Posición geodésica + velocidad en un instante; `null` si SGP4 falla/decaído. */
export function getFix(sat: Sat, date: Date): Fix | null {
  const rec = satrecOf(sat);
  const pv = sgp4Propagate(rec, date);
  if (!pv || rec.error !== SatRecError.None) return null;
  const gmst = gstime(date);
  const gd = eciToGeodetic(pv.position, gmst);
  const velKmS = Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z);
  return {
    tMs: date.getTime(),
    latDeg: degreesLat(gd.latitude),
    lonDeg: normLonDeg(degreesLong(gd.longitude)),
    altKm: gd.height,
    velKmS,
  };
}

/* ----------------------------------------------------- parámetros de órbita */

export interface OrbitParams {
  periodMin: number;
  inclinationDeg: number;
  eccentricity: number;
  semiMajorAxisKm: number;
  apogeeKm: number;
  perigeeKm: number;
  meanMotionRevDay: number;
  bstar: number;
  epoch: Date;
  noradId: number;
}

export function orbitParams(sat: Sat): OrbitParams {
  const rec = satrecOf(sat);
  const nRadMin = rec.nokozai; // v7: rad/min (¡NO rev/día como en v6!)
  const periodMin = (2 * Math.PI) / nRadMin;
  const ecc = rec.ecco;
  // Tercera ley de Kepler con mu de satellite.js (km³/s²) y n en rad/s.
  const nRadSec = nRadMin / 60;
  const smaKm = Math.cbrt(constants.mu / (nRadSec * nRadSec));
  return {
    periodMin,
    inclinationDeg: radiansToDegrees(rec.inclo),
    eccentricity: ecc,
    semiMajorAxisKm: smaKm,
    apogeeKm: smaKm * (1 + ecc) - constants.earthRadius,
    perigeeKm: smaKm * (1 - ecc) - constants.earthRadius,
    meanMotionRevDay: nRadMin * constants.xpdotp, // rad/min × 1440/(2π)
    bstar: rec.bstar,
    epoch: invjday(rec.jdsatepoch),
    noradId: Number(rec.satnum),
  };
}

/* ------------------------------------------------------- trayectoria y huella */

export interface TrackOptions {
  /** Número de órbitas a dibujar (por defecto 1). */
  orbits?: number;
  /** Muestras totales (por defecto 120). */
  samples?: number;
}

export function groundTrack(sat: Sat, start: Date, opts: TrackOptions = {}): Fix[] {
  const orbits = opts.orbits ?? 1;
  const samples = opts.samples ?? 120;
  const periodMs = orbitParams(sat).periodMin * 60_000 * orbits;
  const out: Fix[] = [];
  for (let i = 0; i <= samples; i++) {
    const fix = getFix(sat, new Date(start.getTime() + (periodMs * i) / samples));
    if (fix) out.push(fix);
  }
  return out;
}

export interface Footprint {
  radiusKm: number;
  /** Polígono del círculo de visibilidad (lat/lon en grados). */
  ring: { latDeg: number; lonDeg: number }[];
}

/**
 * Huella de visibilidad desde la altitud actual: casquete esférico de radio
 * angular θ = acos(Re / (Re + h)) alrededor del punto subsatelital.
 */
export function footprint(sat: Sat, date: Date, segments = 64): Footprint | null {
  const fix = getFix(sat, date);
  if (!fix) return null;
  const Re = constants.earthRadius;
  const theta = Math.acos(Math.min(1, Re / (Re + fix.altKm)));
  const radiusKm = theta * Re;
  const phiC = degreesToRadians(fix.latDeg);
  const lamC = degreesToRadians(fix.lonDeg);
  const ring: { latDeg: number; lonDeg: number }[] = [];
  for (let i = 0; i < segments; i++) {
    const b = (2 * Math.PI * i) / segments;
    const lat = Math.asin(
      Math.sin(phiC) * Math.cos(theta) + Math.cos(phiC) * Math.sin(theta) * Math.cos(b),
    );
    const lon =
      lamC +
      Math.atan2(
        Math.sin(b) * Math.sin(theta) * Math.cos(phiC),
        Math.cos(theta) - Math.sin(phiC) * Math.sin(lat),
      );
    ring.push({ latDeg: radiansToDegrees(lat), lonDeg: normLonDeg(radiansToDegrees(lon)) });
  }
  return { radiusKm, ring };
}

/* ------------------------------------------------------------- observador */

function observerGeodetic(obs: Observer) {
  return {
    longitude: degreesToRadians(obs.longitude),
    latitude: degreesToRadians(obs.latitude),
    height: (obs.elevationM ?? 0) / 1000, // km
  };
}

export interface LookAnglesNow {
  azDeg: number;
  elDeg: number;
  rangeKm: number;
}

export function lookAngles(sat: Sat, obs: Observer, date: Date): LookAnglesNow | null {
  const rec = satrecOf(sat);
  const pv = sgp4Propagate(rec, date);
  if (!pv || rec.error !== SatRecError.None) return null;
  const ecf = eciToEcf(pv.position, gstime(date));
  const la = ecfToLookAngles(observerGeodetic(obs), ecf);
  return {
    azDeg: norm360(radiansToDegrees(la.azimuth)),
    elDeg: radiansToDegrees(la.elevation),
    rangeKm: la.rangeSat,
  };
}

function norm360(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

/**
 * Rumbo inicial (grados, 0 = norte, sentido horario) entre dos puntos
 * geodésicos — fórmula de círculo máximo, con Δλ normalizada para que el
 * cruce del antimeridiano no invierta el ángulo. Se usa para orientar los
 * iconos del mapa según el movimiento orbital entre t y t+Δ.
 */
export function bearingDeg(
  a: { latDeg: number; lonDeg: number },
  b: { latDeg: number; lonDeg: number },
): number {
  const phi1 = degreesToRadians(a.latDeg);
  const phi2 = degreesToRadians(b.latDeg);
  let dLon = degreesToRadians(b.lonDeg - a.lonDeg);
  dLon = Math.atan2(Math.sin(dLon), Math.cos(dLon)); // normaliza a [-π, π]
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return norm360(radiansToDegrees(Math.atan2(y, x)));
}

/* ------------------------------------------------------------------ solar */

export interface SolarInfo {
  sunlit: boolean;
  shadowFraction: number;
  /** Hora solar local (0–24) en el punto subsatelital. */
  localSolarTimeH: number;
  /** Hora solar local (0–24) en el observador (si se aporta). */
  observerSolarTimeH?: number;
}

export function solarInfo(sat: Sat, date: Date, obs?: Observer): SolarInfo | null {
  const rec = satrecOf(sat);
  const pv = sgp4Propagate(rec, date);
  if (!pv || rec.error !== SatRecError.None) return null;
  const gmst = gstime(date);
  const gd = eciToGeodetic(pv.position, gmst);
  const sun = sunPos(jday(date)); // v7: rsun es {x,y,z} en AU (no array)
  const sf = shadowFraction(sun.rsun, pv.position);
  const solarTimeAt = (lonEastRad: number): number => {
    // Ángulo horario del Sol: H = GMST + λ(este) − RA(sol); mediodía solar con H = 0.
    let h = gmst + lonEastRad - sun.rtasc;
    h = Math.atan2(Math.sin(h), Math.cos(h)); // normaliza a [-π, π]
    return (12 + (radiansToDegrees(h) / 15) + 24) % 24;
  };
  return {
    sunlit: sf === 0,
    shadowFraction: sf,
    localSolarTimeH: solarTimeAt(gd.longitude),
    observerSolarTimeH: obs ? solarTimeAt(degreesToRadians(obs.longitude)) : undefined,
  };
}

/**
 * Terminador solar (línea día/noche) como anillo poligonal listo para Leaflet.
 *
 * Matemática: el Sol está en el cenit del punto subsolar (lat = declinación,
 * lon = rtasc − GMST). El terminador es el círculo mayor a 90° de ese punto;
 * su latitud para cada longitud cumple  tan φ = −cos H / tan δ, con H el
 * ángulo horario local (H = GMST + λ − rtasc). El polígono se cierra por el
 * polo en noche (−90° si δ>0, +90° si δ<0).
 */
export function terminatorPolygon(
  date: Date,
  stepDeg = 4,
): { latDeg: number; lonDeg: number }[] {
  const sun = sunPos(jday(date));
  const gmst = gstime(date);
  const decl = sun.decl; // radianes
  const ring: { latDeg: number; lonDeg: number }[] = [];
  for (let lon = -180; lon <= 180; lon += stepDeg) {
    const H = gmst + degreesToRadians(lon) - sun.rtasc;
    const lat = Math.atan(-Math.cos(H) / Math.tan(decl));
    ring.push({ latDeg: radiansToDegrees(lat), lonDeg: lon });
  }
  const poleLat = decl > 0 ? -90 : 90; // polo en noche
  ring.push({ latDeg: poleLat, lonDeg: 180 });
  ring.push({ latDeg: poleLat, lonDeg: -180 });
  return ring;
}

/** Estado "ahora" completo para la cabecera de detalle. */
export function forecastNow(sat: Sat, date: Date, obs?: Observer): ForecastNow | null {
  const fix = getFix(sat, date);
  if (!fix) return null;
  const sol = solarInfo(sat, date);
  const look = obs ? lookAngles(sat, obs, date) : null;
  return {
    iso: date.toISOString(),
    latDeg: fix.latDeg,
    lonDeg: fix.lonDeg,
    altKm: fix.altKm,
    velKmS: fix.velKmS,
    azDeg: look?.azDeg,
    elDeg: look?.elDeg,
    rangeKm: look?.rangeKm,
    sunlit: sol ? sol.sunlit : true,
    shadowFraction: sol ? sol.shadowFraction : 0,
  };
}

/* ------------------------------------------------------------------ pasos */

export interface PassOptions {
  /** Duración de la ventana en horas (por defecto 24). */
  durationHours?: number;
  /** Elevación mínima en grados (por defecto 0). */
  minElDeg?: number;
  /** Paso de muestreo grueso en segundos (por defecto 30). */
  coarseStepSec?: number;
  /** Máximo de pasos a devolver (por defecto 20). */
  maxPasses?: number;
}

/**
 * Predicción de pasos: muestreo grueso de elevación, detección de cruces por
 * el umbral y refinado por bisección (< ~0.1 s). Solo devuelve pasos completos
 * dentro de la ventana.
 */
export function predictPasses(
  sat: Sat,
  obs: Observer,
  start: Date,
  opts: PassOptions = {},
): Pass[] {
  const durationMs = (opts.durationHours ?? 24) * 3_600_000;
  const minEl = opts.minElDeg ?? 0;
  const stepMs = (opts.coarseStepSec ?? 30) * 1000;
  const maxPasses = opts.maxPasses ?? 20;

  const elAt = (tMs: number): number | null => {
    const la = lookAngles(sat, obs, new Date(tMs));
    return la ? la.elDeg : null;
  };

  const bisect = (tA: number, tB: number, sign: 1 | -1): number => {
    // sign=+1: el cruza de <minEl a >minEl entre tA y tB (AOS); -1: LOS.
    let lo = tA;
    let hi = tB;
    for (let i = 0; i < 24 && hi - lo > 100; i++) {
      const mid = (lo + hi) / 2;
      const el = elAt(mid);
      const above = el !== null && el > minEl;
      if (sign === 1) {
        if (above) hi = mid;
        else lo = mid;
      } else {
        if (above) lo = mid;
        else hi = mid;
      }
    }
    return (lo + hi) / 2;
  };

  const passes: Pass[] = [];
  const t0 = start.getTime();
  const tEnd = t0 + durationMs;
  let prevT = t0;
  let prevEl = elAt(t0);
  let inPass = prevEl !== null && prevEl > minEl;

  for (let t = t0 + stepMs; t <= tEnd && passes.length < maxPasses; t += stepMs) {
    const el = elAt(t);
    const above = el !== null && el > minEl;
    if (!inPass && above && prevEl !== null) {
      const aosMs = bisect(prevT, t, 1);
      // Buscar el fin del paso (máx. 3 horas por paso en LEO).
      let losMs: number | null = null;
      let maxEl = -90;
      let tcaMs: number | null = null;
      const fineStepMs = 5000;
      const horizon = Math.min(aosMs + 3 * 3_600_000, tEnd);
      // Empezar DESPUÉS de AOS: en el propio AOS la elevación roza el umbral y
      // el refinado puede dar losMs ≈ aosMs (destellos numéricos, no pasos).
      for (let u = aosMs + fineStepMs; u <= horizon; u += fineStepMs) {
        const e = elAt(u);
        if (e === null) break;
        if (e > maxEl) {
          maxEl = e;
          tcaMs = u;
        }
        if (e <= minEl) {
          losMs = bisect(u - fineStepMs, u, -1);
          break;
        }
      }
      // Solo pasos completos, reales (≥ 1 s) y con máximo estrictamente interior.
      if (
        losMs !== null &&
        losMs <= tEnd &&
        tcaMs !== null &&
        maxEl > minEl &&
        losMs - aosMs > 1000
      ) {
        tcaMs = Math.min(Math.max(tcaMs, aosMs + 1), losMs - 1);
        const rise = lookAngles(sat, obs, new Date(aosMs));
        const set = lookAngles(sat, obs, new Date(losMs));
        passes.push({
          aosMs,
          tcaMs,
          losMs,
          maxElDeg: maxEl,
          azRiseDeg: rise ? rise.azDeg : 0,
          azSetDeg: set ? set.azDeg : 0,
          durationMin: (losMs - aosMs) / 60000,
        });
      }
      inPass = above;
    } else if (!above) {
      inPass = false;
    }
    prevT = t;
    prevEl = el;
  }
  return passes;
}
