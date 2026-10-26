/**
 * Interpolación lineal entre dos fixes SGP4 (suaviza movimiento entre ticks).
 */

export interface FixLike {
  latDeg: number;
  lonDeg: number;
  altKm: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpola longitud evitando saltos ±180°. */
export function lerpLon(a: number, b: number, t: number): number {
  let d = b - a;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  let out = a + d * t;
  if (out > 180) out -= 360;
  if (out < -180) out += 360;
  return out;
}

export function interpolateFix(a: FixLike, b: FixLike, t: number): FixLike {
  const u = Math.min(1, Math.max(0, t));
  return {
    latDeg: lerp(a.latDeg, b.latDeg, u),
    lonDeg: lerpLon(a.lonDeg, b.lonDeg, u),
    altKm: lerp(a.altKm, b.altKm, u),
  };
}
