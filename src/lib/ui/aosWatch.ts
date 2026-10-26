/**
 * Detección AOS/LOS: cruce de elevación 0° respecto al observador.
 */

export type PassEdge = "aos" | "los";

/** Detecta cruce de horizonte entre dos muestras de elevación (grados). */
export function detectElevationCross(
  prevElDeg: number | null,
  nextElDeg: number,
): PassEdge | null {
  if (prevElDeg === null || !Number.isFinite(prevElDeg) || !Number.isFinite(nextElDeg)) {
    return null;
  }
  if (prevElDeg < 0 && nextElDeg >= 0) return "aos";
  if (prevElDeg >= 0 && nextElDeg < 0) return "los";
  return null;
}
