/**
 * Hook de detección de viewport y clase de tamaño (Material Design 3 / Responsive).
 * - compact: width < 600 dp
 * - medium: 600 <= width < 840 dp
 * - expanded: width >= 840 dp
 * Sincroniza atributos data-size y data-orientation en <html> para estilización CSS directa.
 * Maneja tanto navegadores de escritorio como WebViews móviles nativos (Capacitor/Android)
 * donde window.innerWidth puede reportar píxeles físicos.
 */
import { useEffect, useState } from "react";

export type SizeClass = "compact" | "medium" | "expanded";
export type Orientation = "portrait" | "landscape";

export interface ViewportState {
  width: number;
  height: number;
  orientation: Orientation;
  sizeClass: SizeClass;
  dpr: number;
}

function computeViewport(): ViewportState {
  if (typeof window === "undefined") {
    return { width: 1280, height: 800, orientation: "landscape", sizeClass: "expanded", dpr: 1 };
  }
  const rawW = window.innerWidth;
  const rawH = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;

  const isNativeMobile =
    Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) ||
    (rawW > 600 && dpr > 1 && rawW <= 2560 && /Mobi|Android/i.test(navigator.userAgent));

  const width = isNativeMobile && rawW > 600 ? rawW / dpr : rawW;
  const height = isNativeMobile && rawH > 600 ? rawH / dpr : rawH;

  const orientation: Orientation = width >= height ? "landscape" : "portrait";
  let sizeClass: SizeClass = "expanded";
  if (width < 600) {
    sizeClass = "compact";
  } else if (width < 840) {
    sizeClass = "medium";
  }
  return { width, height, orientation, sizeClass, dpr };
}

export function useViewport(): ViewportState {
  const [viewport, setViewport] = useState<ViewportState>(computeViewport);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let rafId = 0;
    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const next = computeViewport();
        setViewport(next);
        const root = document.documentElement;
        root.setAttribute("data-size", next.sizeClass);
        root.setAttribute("data-orientation", next.orientation);
      });
    };

    const initial = computeViewport();
    const root = document.documentElement;
    root.setAttribute("data-size", initial.sizeClass);
    root.setAttribute("data-orientation", initial.orientation);

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  return viewport;
}
