/**
 * Puerta de validación ESTRICTA de TLEs (única fuente de verdad del criterio).
 *
 * Se aplica en la fase de parseo/carga (Ivan, SatNOGS y seed) para que el
 * catálogo en memoria, el worker SGP4 y el canvas de Leaflet SOLO vean
 * satélites con órbita matemáticamente viable y TLE vigente:
 *
 *   1. Integridad: 69 caracteres/línea + checksum CelesTrak + campos (validateTle).
 *   2. Época: ilegible/ilegal → invalid; futura → future; edad > MAX_TLE_AGE_DAYS
 *      (30 d por defecto) → expired (DESCARTADO por completo, no "stale visible").
 *   3. Basura orbital: nombres debris/R/B/OBJECT/designador → junk, salvo que el
 *      NORAD esté en la lista de interés explícito (`interest`).
 *   4. Viabilidad orbital: movimiento medio 0.5–17.6 rev/d y ecc ≤ 0.9,
 *      else → implausible.
 *   5. Reingreso: `propagate(..., { communityDecayCheckEnabled: true })` +
 *      `checkForDecay` (satellite.js 7.1.0) → decayed.
 *
 * Todo rechazo es auditable: `filterActiveSatellites` devuelve un CatalogStats
 * completo (seen = valid + Σ rechazos).
 */
import { checkForDecay, propagate, twoline2satrec } from "satellite.js";

import { groupOf, junk } from "./groups";
import { diagnoseTleEpoch } from "./tle-epoch";
import { validateTle } from "./tle-validation";
import type { CatalogStats, EpochStatus, GroupId, Sat, SourceId } from "./types";

/** Umbral estricto de caducidad: > 30 días ⇒ descarte automático. */
export const MAX_TLE_AGE_DAYS = 30;

/**
 * Rango viable de movimiento medio para órbitas terrestres (rev/día):
 * cubre desde HEO científicas (TESS ≈ 0.07 rev/d, P ≈ 13.7 d) hasta LEO
 * bajas (~17.6 rev/d). Fuera de esto: órbitas no terrestres o erráticas.
 */
const MM_MIN = 0.05;
const MM_MAX = 17.6;
/** Excentricidad máxima viable para un objeto terrestre operativo. */
const ECC_MAX = 0.9;

export interface FilterRow {
  id: number | string;
  name: string;
  line1: string;
  line2: string;
  group?: GroupId;
  source?: SourceId;
}

export type GateRejectReason =
  | "checksum"
  | "epochInvalid"
  | "epochFuture"
  | "epochExpired"
  | "junk"
  | "implausible"
  | "decayed";

export type GateResult =
  | { ok: true; bucket: Extract<EpochStatus, "fresh" | "aging" | "stale"> }
  | { ok: false; reason: GateRejectReason };

export interface GateOptions {
  now?: Date;
  maxAgeDays?: number;
  /** Filtro de basura orbital activado por defecto. */
  filterJunk?: boolean;
  /** NORADs de interés explícito: bypassan el filtro junk. */
  interest?: ReadonlySet<number>;
  /** Comprobación de decaimiento SGP4 activada por defecto. */
  decayCheck?: boolean;
  /** Inyectable para tests: sustituye la comprobación real de decaimiento. */
  isDecayed?: (row: FilterRow, now: Date) => boolean;
}

/** Viabilidad orbital pura (sin propagar): mm y excentricidad en rango terrestre. */
export function orbitPlausible(line2: string): boolean {
  if (typeof line2 !== "string" || line2.length < 63) return false;
  const mm = Number(line2.slice(52, 63).trim());
  const ecc = Number(`0.${line2.slice(26, 33)}`);
  if (!Number.isFinite(mm) || mm < MM_MIN || mm > MM_MAX) return false;
  if (!Number.isFinite(ecc) || ecc < 0 || ecc > ECC_MAX) return false;
  return true;
}

/** Decaimiento real vía SGP4 (community decay check de satellite.js 7.1.0). */
export function isDecayedReal(row: FilterRow, now: Date): boolean {
  try {
    const rec = twoline2satrec(row.line1, row.line2);
    const pv = propagate(rec, now, { communityDecayCheckEnabled: true });
    return !pv || checkForDecay(rec);
  } catch {
    return true; // TLE que ni siquiera parsea en SGP4: fuera
  }
}

/** Puerta de validación de UNA fila. Pura e inyectable (tests). */
export function gateRow(row: FilterRow, opts: GateOptions = {}): GateResult {
  const now = opts.now ?? new Date();
  const maxAge = opts.maxAgeDays ?? MAX_TLE_AGE_DAYS;
  const id = Number(row.id);

  // 1) Integridad estructural + checksum CelesTrak
  if (
    !Number.isInteger(id) ||
    id < 1 ||
    id > 99999 ||
    !validateTle(id, row.line1, row.line2).valid
  ) {
    return { ok: false, reason: "checksum" };
  }

  // 2) Época: ilegal / futura / caducada
  const d = diagnoseTleEpoch(row.line1, now);
  if (d.status === "invalid") return { ok: false, reason: "epochInvalid" };
  if (d.status === "future") return { ok: false, reason: "epochFuture" };
  if ((d.ageDays ?? 0) > maxAge) return { ok: false, reason: "epochExpired" };

  // 3) Basura orbital (con bypass por interés explícito)
  if ((opts.filterJunk ?? true) && junk(row.name) && !opts.interest?.has(id)) {
    return { ok: false, reason: "junk" };
  }

  // 4) Viabilidad orbital
  if (!orbitPlausible(row.line2)) return { ok: false, reason: "implausible" };

  // 5) Reingreso / decaimiento
  const decayFn = opts.isDecayed ?? isDecayedReal;
  if ((opts.decayCheck ?? true) && decayFn(row, now)) {
    return { ok: false, reason: "decayed" };
  }

  return { ok: true, bucket: d.status };
}

export function emptyStats(): CatalogStats {
  return {
    seen: 0,
    valid: 0,
    fresh: 0,
    aging: 0,
    stale: 0,
    future: 0,
    invalid: 0,
    junk: 0,
    expired: 0,
    implausible: 0,
    decayed: 0,
    bySource: { satnogs: 0, ivan: 0 },
    seenBySource: { satnogs: 0, ivan: 0 },
    failedBySource: { satnogs: 0, ivan: 0 },
  };
}

/** Contador de rechazos por razón (para stats incrementales y por lote). */
export function countReject(stats: CatalogStats, reason: GateRejectReason): void {
  switch (reason) {
    case "checksum":
    case "epochInvalid":
      stats.invalid++;
      break;
    case "epochFuture":
      stats.future++;
      break;
    case "epochExpired":
      stats.expired++;
      break;
    case "junk":
      stats.junk++;
      break;
    case "implausible":
      stats.implausible++;
      break;
    case "decayed":
      stats.decayed++;
      break;
  }
}

/**
 * Filtra un lote completo en la fase de parseo y devuelve ÚNICAMENTE los
 * satélites vigentes (`activeSatellites`) + stats auditables.
 * Invariante: seen === valid + invalid + future + expired + junk + implausible + decayed.
 */
export function filterActiveSatellites(
  rows: FilterRow[],
  opts: GateOptions = {},
): { sats: Sat[]; stats: CatalogStats } {
  const stats = emptyStats();
  const sats: Sat[] = [];
  for (const row of rows) {
    stats.seen++;
    if (row.source) stats.seenBySource[row.source]++;
    const g = gateRow(row, opts);
    if (!g.ok) {
      countReject(stats, g.reason);
      continue;
    }
    stats[g.bucket]++;
    stats.valid++;
    if (row.source) stats.bySource[row.source]++;
    sats.push({
      id: Number(row.id),
      name: (row.name ?? "").trim(),
      line1: row.line1,
      line2: row.line2,
      group: row.group ?? groupOf(row.name ?? ""),
    });
  }
  return { sats, stats };
}
