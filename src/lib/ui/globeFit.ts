/**
 * Lógica pura de dimensionado del globo ortográfico (Tarea 4 / 7).
 * Mantiene el factor de fit del canvas sin acoplarse al DOM.
 */

/** Escala que encaja el globo completo (1:1) con margen ~20 %. */
export function fitScale(containerWidth: number, containerHeight: number, factor = 0.4): number {
  const w = Math.max(1, containerWidth);
  const h = Math.max(1, containerHeight);
  return Math.max(40, Math.min(w, h) * factor);
}

/** DPR de dibujo acotado (batería/VRAM en móvil). */
export function clampDpr(devicePixelRatio: number, max = 2): number {
  const d = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(max, d);
}

/** Tamaño del buffer de canvas en píxeles físicos. */
export function canvasBufferSize(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  maxDpr = 2,
): { width: number; height: number; dpr: number } {
  const dpr = clampDpr(devicePixelRatio, maxDpr);
  const w = Math.max(1, Math.round(Math.max(1, cssWidth) * dpr));
  const h = Math.max(1, Math.round(Math.max(1, cssHeight) * dpr));
  return { width: w, height: h, dpr };
}

/**
 * Conserva el zoom relativo del usuario al cambiar el contenedor.
 * scale === 0 o prevFit === 0 → arranque en fit.
 */
export function scaleAfterResize(
  currentScale: number,
  prevFit: number,
  nextW: number,
  nextH: number,
  factor = 0.4,
): { scale: number; fit: number; userZoom: number } {
  const fit = fitScale(nextW, nextH, factor);
  if (currentScale === 0 || prevFit === 0) {
    return { scale: fit, fit, userZoom: 1 };
  }
  const userZoom = currentScale / prevFit;
  const scale = Math.max(40, Math.min(fit * 3.5, fit * userZoom));
  return { scale, fit, userZoom };
}

/** Clasificación de filas de la matriz Tarea 7 (ancho CSS lógico). */
export const MATRIX_VIEWPORTS = [
  { id: "phone-small", w: 360, h: 640, label: "360×640 pequeño" },
  { id: "phone-std", w: 360, h: 800, label: "360×800 estándar" },
  { id: "phone-large", w: 412, h: 915, label: "412×915 grande" },
  { id: "tablet-7", w: 600, h: 960, label: "600×960 tablet 7\"" },
  { id: "tablet-10", w: 800, h: 1280, label: "800×1280 tablet 10\"" },
  { id: "fold-outer", w: 280, h: 653, label: "280×653 plegable exterior (aprox.)" },
  { id: "fold-inner", w: 673, h: 841, label: "673×841 plegable interior (aprox.)" },
] as const;
