/**
 * Tarea 6 — puente WebView Android: StatusBar + gesto/botón atrás.
 * No añade dependencias nuevas; StatusBar ya está en package.json.
 * El evento `st-android-back` lo consume App.tsx (mismo camino que Escape).
 */

const BG = "#030508";

export function installAndroidChrome(): () => void {
  const cleanups: Array<() => void> = [];

  // StatusBar (Capacitor) — overlaysWebView ya en capacitor.config.json
  void import("@capacitor/status-bar")
    .then(({ StatusBar, Style }) =>
      Promise.all([
        StatusBar.setStyle({ style: Style.Dark }),
        StatusBar.setBackgroundColor({ color: BG }),
        StatusBar.setOverlaysWebView({ overlay: true }),
      ]),
    )
    .catch(() => {
      /* web / tauri: sin plugin */
    });

  // Historial: cada overlay empuja un estado; popstate cierra
  const onPopState = () => {
    window.dispatchEvent(new CustomEvent("st-android-back"));
  };
  window.addEventListener("popstate", onPopState);
  cleanups.push(() => window.removeEventListener("popstate", onPopState));

  // Capacitor App.backButton (opcional si el usuario añade @capacitor/app)
  void import("@capacitor/app")
    .then(({ App }) => {
      let handle: { remove: () => void } | undefined;
      void App.addListener("backButton", () => {
        const open =
          document.documentElement.dataset.sheetOpen === "1" ||
          document.documentElement.dataset.detailOpen === "1";
        if (open) {
          window.dispatchEvent(new CustomEvent("st-android-back"));
        } else {
          void App.exitApp();
        }
      }).then((h) => {
        handle = h;
      });
      cleanups.push(() => {
        handle?.remove();
      });
    })
    .catch(() => {
      /* plugin no instalado: solo popstate + Escape */
    });

  return () => {
    for (const c of cleanups) c();
  };
}

/** Llamar al abrir/cerrar sheets para que atrás del sistema cierre primero el panel. */
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
