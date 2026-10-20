/**
 * Botones de ventana personalizados para el modo sin decoraciones de Tauri
 * (`decorations: false`). Solo se renderizan en entorno nativo Tauri; en web
 * o Capacitor el componente devuelve null.
 *
 * SIN dependencia del paquete API de Tauri en el bundle: se usa el global
 * inyectado (`withGlobalTauri: true` en tauri.conf.json → `window.__TAURI__`).
 * Así el bundle web y el dev-server de Vite nunca necesitan resolver el
 * paquete nativo (regresión cubierta por scripts/native-guards.test.mjs).
 */
import { isTauri } from "../../lib/ui/native";

interface TauriWindowLike {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
}

function tauriWin(): TauriWindowLike | null {
  const g = window as unknown as {
    __TAURI__?: { window?: { getCurrentWindow(): TauriWindowLike } };
  };
  return g.__TAURI__?.window?.getCurrentWindow() ?? null;
}

const act = (fn: (w: TauriWindowLike) => Promise<void>) => () => {
  const w = tauriWin();
  if (w) void fn(w).catch(() => undefined);
};

export default function WindowControls() {
  if (!isTauri()) return null;
  return (
    <div className="st-winctrl">
      <button className="st-winbtn" title="Minimizar" onClick={act((w) => w.minimize())}>
        ─
      </button>
      <button
        className="st-winbtn"
        title="Maximizar / restaurar"
        onClick={act((w) => w.toggleMaximize())}
      >
        ▢
      </button>
      <button className="st-winbtn close" title="Cerrar" onClick={act((w) => w.close())}>
        ✕
      </button>
    </div>
  );
}
