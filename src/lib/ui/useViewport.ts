/**
 * Detección de viewport y clase de tamaño (Material Design 3 / window size classes).
 *
 * - compact:  width < 600
 * - medium:   600 ≤ width < 840
 * - expanded: width ≥ 840
 *
 * Publica en <html>:
 *   data-size, data-orientation, data-touch
 * y variables CSS:
 *   --vw, --vh  (píxeles CSS del layout viewport)
 *
 * Tarea 2 del plan responsive (PROMPT_AGENTE_RESPONSIVE_MOVIL.md).
 */
import { useEffect, useState } from "react";

export type SizeClass = "compact" | "medium" | "expanded";
export type Orientation = "portrait" | "landscape";

/** Límites Material Design 3 (window size classes), en CSS px ≈ dp en WebView. */
export const SIZE_COMPACT_MAX = 599;
export const SIZE_MEDIUM_MAX = 839;

export interface ViewportState {
  /** Ancho del layout viewport en CSS px. */
  width: number;
  /** Alto del layout viewport en CSS px. */
  height: number;
  orientation: Orientation;
  sizeClass: SizeClass;
  dpr: number;
  /** matchMedia('(pointer: coarse)') — preferir targets táctiles. */
  isTouch: boolean;
  /** matchMedia('(prefers-reduced-motion: reduce)'). */
  prefersReducedMotion: boolean;
  /**
   * Alto útil del visualViewport (teclado abierto, barras del sistema).
   * Coincide con height cuando no hay teclado / no hay Visual Viewport API.
   */
  visualViewportHeight: number;
}

/** Clasificación pura por ancho (testeable sin DOM). */
export function classifySize(width: number): SizeClass {
  if (width <= SIZE_COMPACT_MAX) return "compact";
  if (width <= SIZE_MEDIUM_MAX) return "medium";
  return "expanded";
}

/** Orientación pura por relación de lados. */
export function classifyOrientation(width: number, height: number): Orientation {
  return width >= height ? "landscape" : "portrait";
}

function matchMq(query: string, fallback: boolean): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return fallback;
  }
  try {
    return window.matchMedia(query).matches;
  } catch {
    return fallback;
  }
}

/**
 * Lectura pura del estado actual.
 * En SSR / tests sin window devuelve un desktop expandido seguro.
 *
 * Nota: window.innerWidth/Height en WebView Android con viewport meta correcto
 * ya están en CSS px (≈ dp). No se divide por devicePixelRatio.
 */
export function readViewport(): ViewportState {
  if (typeof window === "undefined") {
    return {
      width: 1280,
      height: 800,
      orientation: "landscape",
      sizeClass: "expanded",
      dpr: 1,
      isTouch: false,
      prefersReducedMotion: false,
      visualViewportHeight: 800,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  const vv = window.visualViewport;
  const visualViewportHeight = vv?.height ?? height;

  return {
    width,
    height,
    orientation: classifyOrientation(width, height),
    sizeClass: classifySize(width),
    dpr,
    isTouch: matchMq("(pointer: coarse)", false),
    prefersReducedMotion: matchMq("(prefers-reduced-motion: reduce)", false),
    visualViewportHeight,
  };
}

/** Escribe atributos y variables CSS en <html> para maquetar sin JS. */
export function applyViewportToDocument(state: ViewportState): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-size", state.sizeClass);
  root.setAttribute("data-orientation", state.orientation);
  root.setAttribute("data-touch", state.isTouch ? "true" : "false");
  root.style.setProperty("--vw", `${state.width}px`);
  root.style.setProperty("--vh", `${state.height}px`);
}

export function useViewport(): ViewportState {
  const [viewport, setViewport] = useState<ViewportState>(readViewport);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let rafId = 0;

    const publish = () => {
      const next = readViewport();
      setViewport(next);
      applyViewportToDocument(next);
    };

    const schedule = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(publish);
    };

    // Estado inicial inmediato (también tras hidratar).
    publish();

    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", schedule);
      vv.addEventListener("scroll", schedule);
    }

    // Preferencias del sistema (sin polling).
    const mqTouch =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(pointer: coarse)")
        : null;
    const mqMotion =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;

    const onMq = () => schedule();
    mqTouch?.addEventListener?.("change", onMq);
    mqMotion?.addEventListener?.("change", onMq);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      if (vv) {
        vv.removeEventListener("resize", schedule);
        vv.removeEventListener("scroll", schedule);
      }
      mqTouch?.removeEventListener?.("change", onMq);
      mqMotion?.removeEventListener?.("change", onMq);
    };
  }, []);

  return viewport;
}
