/** Persistencia local del observador y zonas horarias.
 *  (Los favoritos v2 viven en lib/ui/favorites.ts con su propia clave y migración.) */

import type { Observer } from "../space/types";

const OBS_KEY = "spacetracker:observer:v1";

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* almacenamiento no disponible (modo privado, cuota…) */
  }
}

const DEFAULT_OBSERVER: Observer = {
  name: "Madrid",
  latitude: 40.4168,
  longitude: -3.7038,
  timezone: "Europe/Madrid",
};

export function loadObserver(): Observer {
  try {
    const raw = safeGet(OBS_KEY);
    if (!raw) return DEFAULT_OBSERVER;
    const o = JSON.parse(raw) as Observer;
    if (
      typeof o?.name !== "string" ||
      typeof o.latitude !== "number" ||
      typeof o.longitude !== "number" ||
      typeof o.timezone !== "string"
    ) {
      return DEFAULT_OBSERVER;
    }
    return o;
  } catch {
    return DEFAULT_OBSERVER;
  }
}

export function saveObserver(obs: Observer | null): void {
  if (obs === null) {
    try {
      window.localStorage.removeItem(OBS_KEY);
    } catch {
      /* noop */
    }
    return;
  }
  safeSet(OBS_KEY, JSON.stringify(obs));
}

/* ---------------------------------------------- paneles (Modo Teatro) */

const PANELS_KEY = "spacetracker:panels:v1";

/**
 * Solo el panel de misión izquierdo es conmutable manualmente; el drawer de
 * detalles derecho se deriva de la selección (oculto por defecto).
 * En pantallas estrechas el panel izquierdo arranca cerrado: el mapa respira.
 */
export interface PanelsState {
  left: boolean;
}

export function loadPanels(): PanelsState {
  try {
    const raw = safeGet(PANELS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as PanelsState;
      if (typeof p?.left === "boolean") return { left: p.left };
    }
  } catch {
    /* corrupto: valores por defecto */
  }
  // El mapa "respira" por defecto: el panel de misión arranca cerrado en
  // cualquier viewport; se abre con la pestaña « o el botón ⛶.
  return { left: false };
}

export function savePanels(p: PanelsState): void {
  safeSet(PANELS_KEY, JSON.stringify(p));
}

/** Zonas horarias IANA disponibles (con lista mínima de respaldo). */
export function availableTimezones(): string[] {
  const fallback = [
    "UTC",
    "Europe/Madrid",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Moscow",
    "America/New_York",
    "America/Mexico_City",
    "America/Bogota",
    "America/Lima",
    "America/Santiago",
    "America/Argentina/Buenos_Aires",
    "America/Sao_Paulo",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Australia/Sydney",
  ];
  try {
    const values = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf?.("timeZone");
    return values && values.length > 0 ? values : fallback;
  } catch {
    return fallback;
  }
}
