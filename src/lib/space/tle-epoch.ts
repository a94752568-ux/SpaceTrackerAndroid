/**
 * Diagnóstico de época TLE.
 *
 * Reglas (Etapa 1, verificadas):
 * - Año de época de 2 dígitos: 57–99 → 1957–1999; 00–56 → 2000–2056.
 * - Se valida año/día fraccional (1 ≤ día ≤ 365|366 según bisiesto).
 * - Épocas futuras → estado `future` (la ingesta las RECHAZA).
 * - `fresh`: edad ≤ 3 días; `aging`: > 3 y ≤ 14 días; `stale`: > 14 días.
 *   Los TLE antiguos se conservan con su diagnóstico (no se rechazan).
 */

import type { EpochStatus } from "./types";

export const FRESH_MAX_DAYS = 3;
export const AGING_MAX_DAYS = 14;
/**
 * Tolerancia para no clasificar como `future` una época "ahora mismo" por
 * redondeos de punto flotante al convertir día fraccional ↔ ms.
 */
export const FUTURE_TOLERANCE_MS = 60_000;
/**
 * Épsilon (~86 ms) absorbido en las fronteras fresh/aging/stale: el día
 * fraccional del TLE tiene 8 decimales y su conversión a ms introduce ±0.5 ms;
 * sin épsilon, una edad de exactamente 3.000 días alternaría fresh/aging.
 */
export const BOUNDARY_EPS_DAYS = 1e-6;

export interface TleEpochDiagnosis {
  status: EpochStatus;
  /** Año completo de la época (si se pudo parsear). */
  epochYear?: number;
  /** Día fraccional del año (si se pudo parsear). */
  epochDay?: number;
  /** Instante de la época en ms UTC (si se pudo parsear). */
  epochMs?: number;
  /** Edad en días respecto a `now` (negativa si es futura). */
  ageDays?: number;
  /** Motivo legible cuando status es `future` o `invalid`. */
  reason?: string;
}

/** Ventana de siglo NORAD: 57–99 → 19xx; 00–56 → 20xx. */
export function expandEpochYear(twoDigit: number): number {
  return twoDigit >= 57 ? 1900 + twoDigit : 2000 + twoDigit;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

/**
 * Convierte (año completo, día fraccional del año) a epoch ms UTC.
 * Día 1.0 == 1 de enero 00:00 UTC.
 */
export function epochDayToMs(year: number, dayOfYear: number): number {
  return Date.UTC(year, 0, 1) + (dayOfYear - 1) * 86_400_000;
}

export function diagnoseTleEpoch(
  line1: string,
  now: Date = new Date(),
): TleEpochDiagnosis {
  const invalid = (reason: string): TleEpochDiagnosis => ({ status: "invalid", reason });

  if (typeof line1 !== "string" || line1.length < 32) {
    return invalid("Línea 1 demasiado corta para contener la época");
  }
  const yyText = line1.slice(18, 20);
  const dayText = line1.slice(20, 32).trim();
  if (!/^[0-9]{2}$/.test(yyText)) return invalid(`Año de época ilegible: '${yyText}'`);
  const day = Number(dayText);
  if (!Number.isFinite(day) || dayText === "") return invalid(`Día de época ilegible: '${dayText}'`);

  const yy = Number(yyText);
  const epochYear = expandEpochYear(yy);

  // Día fraccional del año: el estándar TLE numeraba los días desde 1;
  // el rango legal es 1 ≤ doy < (días del año + 1).
  if (day < 1 || day >= daysInYear(epochYear) + 1) {
    return {
      status: "invalid",
      epochYear,
      epochDay: day,
      reason: `Día de época ${day} fuera de rango para ${epochYear}`,
    };
  }

  const epochMs = epochDayToMs(epochYear, day);
  const ageDays = (now.getTime() - epochMs) / 86_400_000;

  if (now.getTime() - epochMs < -FUTURE_TOLERANCE_MS) {
    return {
      status: "future",
      epochYear,
      epochDay: day,
      epochMs,
      ageDays,
      reason: `Época futura (${Math.abs(ageDays).toFixed(2)} días por delante)`,
    };
  }
  const status: EpochStatus =
    ageDays <= FRESH_MAX_DAYS + BOUNDARY_EPS_DAYS
      ? "fresh"
      : ageDays <= AGING_MAX_DAYS + BOUNDARY_EPS_DAYS
        ? "aging"
        : "stale";
  return { status, epochYear, epochDay: day, epochMs, ageDays };
}

/** La ingesta acepta épocas fresh/aging/stale; rechaza future/invalid. */
export function hasValidTleEpoch(line1: string, now: Date = new Date()): boolean {
  const { status } = diagnoseTleEpoch(line1, now);
  return status === "fresh" || status === "aging" || status === "stale";
}
