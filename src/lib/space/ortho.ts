/**
 * Proyección ortográfica esférica (globo 2D que emula 3D) — matemática pura,
 * independiente de d3/canvas para poder testearla en Node.
 *
 * Convención: eje X derecha, eje Y abajo (canvas). `visible` aplica backface
 * culling: solo el hemisferio frontal (cos c > 0) se dibuja.
 */
import { degreesToRadians, radiansToDegrees } from "satellite.js";

export interface OrthoView {
  /** Latitud del centro del globo (grados). */
  latDeg: number;
  /** Longitud del centro del globo (grados). */
  lonDeg: number;
  /** Radio del globo en píxeles. */
  scale: number;
}

export interface OrthoPoint {
  x: number;
  y: number;
  /** false = hemisferio oculto (backface culling). */
  visible: boolean;
  /** cos del ángulo central hacia el centro del globo (0 en el limbo). */
  cosc: number;
}

const rad = degreesToRadians;

export function orthoProject(
  latDeg: number,
  lonDeg: number,
  view: OrthoView,
  cx: number,
  cy: number,
): OrthoPoint {
  const lam = rad(lonDeg - view.lonDeg);
  const phi = rad(latDeg);
  const phi0 = rad(view.latDeg);
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinPhi0 = Math.sin(phi0);
  const cosPhi0 = Math.cos(phi0);
  const cosLam = Math.cos(lam);
  const cosc = sinPhi0 * sinPhi + cosPhi0 * cosPhi * cosLam;
  const x = cx + view.scale * cosPhi * Math.sin(lam);
  const y = cy - view.scale * (cosPhi0 * sinPhi - sinPhi0 * cosPhi * cosLam);
  return { x, y, visible: cosc > 0, cosc };
}

/** Envuelve una longitud al intervalo [-180, 180). */
export function wrapLonDeg(lon: number): number {
  let l = (lon + 180) % 360;
  if (l < 0) l += 360;
  return l - 180;
}

/**
 * Rotación por arrastre: dx/dy en píxeles → grados.
 * Factor geométrico exacto: un píxel sobre el limbo equivale a
 * (180/π)/scale grados, así la sensación de arrastre es 1:1 con la esfera
 * a cualquier zoom.
 */
export function dragToRotation(
  view: OrthoView,
  dxPx: number,
  dyPx: number,
): { latDeg: number; lonDeg: number } {
  const k = 180 / (Math.PI * Math.max(80, view.scale));
  const lat = Math.max(-90, Math.min(90, view.latDeg + dyPx * k));
  return { latDeg: lat, lonDeg: wrapLonDeg(view.lonDeg + dxPx * k) };
}

/** Ángulo de limbo: punto a `deg` del centro hacia el este proyecta al borde. */
export function limbDistanceDeg(): number {
  return 90;
}

/** Utilidad: lat/lon desde radianes (re-export cómodo para el globo). */
export { radiansToDegrees };
