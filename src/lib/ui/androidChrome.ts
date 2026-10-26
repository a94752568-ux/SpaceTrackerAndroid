/**
 * Tarea 6 — puente WebView Android: StatusBar + gesto/botón atrás.
 * Sin dependencia de @capacitor/app (no está en package.json; Vite no puede resolverla).
 * StatusBar sí está instalado. El evento `st-android-back` lo consume App.tsx.
 */

const BG = "#030508";

export function installAndroidChrome(): () => void {
  const cleanups: Array<() => void> = [];

  void import("@capacitor/status-bar")
    .then(({ StatusBar, Style }) =>
      Promise.all([
        StatusBar.setStyle({ style: Style.Dark }),
        StatusBar.setBackgroundColor({ color: BG }),
        StatusBar.setOverlaysWebView({ overlay: true }),
      ]),
    )
    .catch(() => {
      /* web / tauri */
    });

  const onPopState = () => {
    window.dispatchEvent(new CustomEvent("st-android-back"));
  };
  window.addEventListener("popstate", onPopState);
  cleanups.push(() => window.removeEventListener("popstate", onPopState));

  return () => {
    for (const c of cleanups) c();
  };
}

/** Empuja historial al abrir overlays para que el gesto atrás cierre el panel. */
export function syncAndroidHistory(overlayOpen: boolean): void {
  try {
    const st = (history.state as { stOverlay?: boolean } | null) ?? {};
    if (overlayOpen && !st.stOverlay) {
      history.pushState({ stOverlay: true }, "");
    }
  } catch {
    /* ignore */
  }
}
