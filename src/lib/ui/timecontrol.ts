/**
 * Control de tiempo de simulación (helpers puros, testeables sin React).
 *
 * Modelo: la app mantiene `realNow` (tick 1 s) y un estado de simulación
 * { mode: "live" | "frozen", tMs }. En "live" el tiempo de cálculo SGP4 es el
 * real; en "frozen" es un instante fijo ajustable con ±1 h y con el slider
 * (±RANGE_H horas respecto al tiempo real).
 */

/** Ventana del slider: ±24 h alrededor del tiempo real. */
export const RANGE_H = 24;
export const RANGE_MIN = RANGE_H * 60;

const HOUR_MS = 3_600_000;

/** Minutos de desfase (enteros, acotados a ±RANGE_MIN) para el slider. */
export function offsetMinutes(nowMs: number, realNowMs: number): number {
  const raw = Math.round((nowMs - realNowMs) / 60000);
  return Math.max(-RANGE_MIN, Math.min(RANGE_MIN, raw));
}

/** Desplaza un instante un número entero de horas. */
export function shiftMs(tMs: number, hours: number): number {
  return tMs + hours * HOUR_MS;
}

/** Etiqueta legible del desfase: +1.5h, -2h, 0h. */
export function labelOffset(deltaMs: number): string {
  const h = deltaMs / HOUR_MS;
  const rounded = Math.round(h * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${sign}${text}h`;
}
