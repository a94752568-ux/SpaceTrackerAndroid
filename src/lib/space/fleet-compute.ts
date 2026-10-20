/**
 * Cálculo masivo de posiciones de flota (SGP4) compartido entre el Web Worker
 * y el fallback síncrono del hilo principal (tests/SSR/navegadores sin Worker).
 *
 * Empaquetado denso por satélite (STRIDE=6, Float64Array):
 *   [0] latDeg [1] lonDeg [2] altKm [3] velKmS [4] bearingDeg [5] ok(1|0)
 * Con ok=0 el resto de campos va a 0 y el renderer oculta el marcador.
 */
import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  gstime,
  propagate,
  SatRecError,
  twoline2satrec,
} from "satellite.js";

import { bearingDeg } from "./propagate";

export const FLEET_STRIDE = 6;

/** Intervalo de actualización de la flota en vivo (req. de throttling: 1-2 s). */
export const FLEET_UPDATE_MS = 2000;

/** Δ para el rumbo de flota (el bearing varía despacio; 30 s sobra). */
const BEARING_DELTA_MS = 30_000;

export interface FleetSat {
  id: number;
  line1: string;
  line2: string;
}

type SatRec = ReturnType<typeof twoline2satrec>;

/* Caché de satrecs dentro del contexto (worker o main): clave id:line1:line2. */
const recCache = new Map<string, SatRec>();

function satrecOf(s: FleetSat): SatRec {
  const key = `${s.id}:${s.line1}:${s.line2}`;
  let rec = recCache.get(key);
  if (!rec) {
    rec = twoline2satrec(s.line1, s.line2);
    if (recCache.size > 16384) recCache.clear();
    recCache.set(key, rec);
  }
  return rec;
}

function normLon(lon: number): number {
  let l = lon % 360;
  if (l > 180) l -= 360;
  if (l < -180) l += 360;
  return l;
}

/** Frame completo de la flota en `tMs`. Coste: 2 propagaciones por satélite. */
export function computeFleet(sats: FleetSat[], tMs: number): Float64Array {
  const out = new Float64Array(sats.length * FLEET_STRIDE);
  const date = new Date(tMs);
  const dateB = new Date(tMs + BEARING_DELTA_MS);
  const gmst = gstime(date);
  const gmstB = gstime(dateB);
  for (let i = 0; i < sats.length; i++) {
    const o = i * FLEET_STRIDE;
    const rec = satrecOf(sats[i]);
    const pv = propagate(rec, date);
    if (!pv || rec.error !== SatRecError.None) {
      out[o + 5] = 0;
      continue;
    }
    const gd = eciToGeodetic(pv.position, gmst);
    const lat = degreesLat(gd.latitude);
    const lon = normLon(degreesLong(gd.longitude));
    const alt = gd.height;
    const vel = Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z);
    let bear = 0;
    const pv2 = propagate(rec, dateB);
    if (pv2 && rec.error === SatRecError.None) {
      const gd2 = eciToGeodetic(pv2.position, gmstB);
      bear = bearingDeg(
        { latDeg: lat, lonDeg: lon },
        { latDeg: degreesLat(gd2.latitude), lonDeg: normLon(degreesLong(gd2.longitude)) },
      );
    }
    out[o] = lat;
    out[o + 1] = lon;
    out[o + 2] = alt;
    out[o + 3] = vel;
    out[o + 4] = bear;
    out[o + 5] = 1;
  }
  return out;
}

export function idsOf(sats: FleetSat[]): Int32Array {
  return Int32Array.from(sats, (s) => s.id);
}
