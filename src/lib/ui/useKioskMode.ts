/**
 * useKioskMode — conmutación de pantalla completa inmersiva (F11 / botón HUD).
 *
 * - En **Tauri v2** usa el global inyectado (`withGlobalTauri: true` →
 *   `window.__TAURI__.window.getCurrentWindow().setFullscreen()`): sin
 *   dependencia de `@tauri-apps/api` en el bundle web (misma regla que
 *   WindowControls; regresión cubierta por native-guards.test.mjs).
 * - En **web estándar** usa la Fullscreen API de HTML5 sobre
 *   `document.documentElement`, sincronizando estado con `fullscreenchange`.
 * - Captura `F11` y el alias táctico `F`/`f` globalmente y anula el
 *   comportamiento por defecto del navegador. La `F` se ignora si el foco está
 *   en un campo de texto (búsqueda, inputs, contentEditable) para no
 *   secuestrar la escritura; con modificadores (Ctrl/Meta/Alt) nunca actúa.
 */
import { useCallback, useEffect, useState } from "react";

import { isTypingTarget } from "./hotkeys";
import { isTauri } from "./native";

interface TauriWinLike {
  setFullscreen(fullscreen: boolean): Promise<void>;
  isFullscreen(): Promise<boolean>;
}

function tauriWin(): TauriWinLike | null {
  const g = window as unknown as {
    __TAURI__?: { window?: { getCurrentWindow(): TauriWinLike } };
  };
  return g.__TAURI__?.window?.getCurrentWindow() ?? null;
}

/**
 * ¿Este evento de teclado debe conmutar el modo kiosco?
 * - `F11`: siempre (es tecla de función; sin modificadores del sistema).
 * - `f` / `F`: alias táctico, SOLO si el foco no está en un campo de texto
 *   (input/textarea/select/contentEditable) para no secuestrar la búsqueda.
 * Pura y SSR-safe: testeable sin DOM completo (basta un target fingido).
 */
export function isKioskKey(e: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.key === "F11") return true;
  if (e.key === "f" || e.key === "F") return !isTypingTarget(e.target);
  return false;
}

/** ¿Hay alguna vía de pantalla completa disponible? (pura, SSR-safe) */
export function kioskSupported(): boolean {
  if (typeof document === "undefined") return false;
  if (isTauri()) return tauriWin() !== null;
  return Boolean(document.fullscreenEnabled);
}

export interface KioskMode {
  isFull: boolean;
  toggle: () => void;
  supported: boolean;
}

export function useKioskMode(): KioskMode {
  const [isFull, setIsFull] = useState(false);

  const sync = useCallback(() => {
    if (typeof document === "undefined") return;
    if (isTauri()) {
      const w = tauriWin();
      if (w) void w.isFullscreen().then(setIsFull).catch(() => undefined);
      return;
    }
    setIsFull(document.fullscreenElement !== null);
  }, []);

  const toggle = useCallback(() => {
    if (isTauri()) {
      const w = tauriWin();
      if (!w) return;
      void w
        .isFullscreen()
        .then((f) => w.setFullscreen(!f))
        .then(sync)
        .catch(() => undefined);
      return;
    }
    if (typeof document === "undefined") return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    }
  }, [sync]);

  /* F11 / F global + sincronía con cambios externos (ESC del navegador, etc.).
     El estado `isFull` es único: el botón del Header refleja el cambio use la
     vía que use (F11, F, botón HUD o fullscreen nativo del navegador). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (!isKioskKey(e)) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", sync);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", sync);
    };
  }, [toggle, sync]);

  useEffect(() => {
    sync();
  }, [sync]);

  return { isFull, toggle, supported: kioskSupported() };
}
