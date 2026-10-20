/**
 * Adaptaciones al entorno nativo (Tauri / Capacitor).
 *
 * - Detección sin dependencias: `window.__TAURI_INTERNALS__` (Tauri v2) y
 *   `window.Capacitor.isNativePlatform()`.
 * - Guards de WebView: en nativo se desactivan menú contextual, pinch-zoom de
 *   gestos Safari/macOS y ctrl+wheel (zoom involuntario de touchpad). En web
 *   NO se tocan: el usuario conserva su comportamiento normal.
 * - El CSS de safe-areas (`env(safe-area-inset-*)` + `viewport-fit=cover`)
 *   ya cubre barras de estado nativas; aquí solo se añade la clase
 *   `st-native` en <html> para ajustes finos (select-none del cromo, etc.).
 */

type Win = Window & {
  __TAURI_INTERNALS__?: unknown;
  Capacitor?: { isNativePlatform?: () => boolean };
};

export function isTauri(): boolean {
  return typeof window !== "undefined" && Boolean((window as Win).__TAURI_INTERNALS__);
}

export function isCapacitor(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as Win).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export function isNative(): boolean {
  return isTauri() || isCapacitor();
}

/**
 * Instala los guards de WebView nativa. Devuelve el cleanup.
 * Seguro de llamar en SSR/Node (no-op).
 */
export function installNativeGuards(): () => void {
  if (typeof window === "undefined" || !isNative()) return () => {};

  const target = window as unknown as EventTarget;
  const prevent = (e: Event) => e.preventDefault();
  const onContextMenu = (e: Event) => e.preventDefault();
  const onWheel = (e: Event) => {
    if ((e as WheelEvent).ctrlKey) e.preventDefault(); // zoom de touchpad
  };

  target.addEventListener("contextmenu", onContextMenu);
  target.addEventListener("gesturestart", prevent); // Safari/macOS WebView
  target.addEventListener("gesturechange", prevent);
  target.addEventListener("wheel", onWheel, { passive: false });
  document.documentElement.classList.add("st-native");

  return () => {
    target.removeEventListener("contextmenu", onContextMenu);
    target.removeEventListener("gesturestart", prevent);
    target.removeEventListener("gesturechange", prevent);
    target.removeEventListener("wheel", onWheel);
    document.documentElement.classList.remove("st-native");
  };
}
