/**
 * Haptics sin plugin Capacitor: Vibration API del WebView/navegador.
 */
import { loadImmersionPrefs } from "./immersionPrefs";

export function hapticTap(ms = 12): void {
  try {
    if (!loadImmersionPrefs().hapticsEnabled) return;
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    navigator.vibrate(ms);
  } catch {
    /* ignore */
  }
}

export function hapticAos(): void {
  hapticTap(18);
}
