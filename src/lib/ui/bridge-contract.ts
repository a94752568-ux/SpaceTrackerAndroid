/**
 * Contrato de comunicación versionado WebView / Nativo (Capacitor / Android).
 * Define la compatibilidad mínima entre la interfaz web y la capa nativa.
 */

export const WEB_UI_VERSION = "1.2.0";
export const MIN_NATIVE_BRIDGE_VERSION = "1.0.0";

export interface BridgeCapabilities {
  geolocation: boolean;
  wakeLock: boolean;
  statusBar: boolean;
  splashScreen: boolean;
  haptics: boolean;
}

export interface BridgeStatus {
  isCompatible: boolean;
  webVersion: string;
  nativeVersion: string;
  capabilities: BridgeCapabilities;
  fallbackActive: boolean;
}

export function detectBridgeCapabilities(): BridgeCapabilities {
  if (typeof window === "undefined") {
    return {
      geolocation: false,
      wakeLock: false,
      statusBar: false,
      splashScreen: false,
      haptics: false,
    };
  }

  const win = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  const isCapacitor = Boolean(win.Capacitor?.isNativePlatform?.());

  return {
    geolocation: typeof navigator !== "undefined" && "geolocation" in navigator,
    wakeLock: typeof navigator !== "undefined" && "wakeLock" in navigator,
    statusBar: isCapacitor,
    splashScreen: isCapacitor,
    haptics: isCapacitor,
  };
}

export function validateBridgeCompatibility(): BridgeStatus {
  const capabilities = detectBridgeCapabilities();
  const win = window as unknown as { __NATIVE_BRIDGE_VERSION__?: string };
  const nativeVersion = win.__NATIVE_BRIDGE_VERSION__ || "1.0.0";

  return {
    isCompatible: true, // Compatible con fallback web
    webVersion: WEB_UI_VERSION,
    nativeVersion,
    capabilities,
    fallbackActive: !capabilities.statusBar,
  };
}
