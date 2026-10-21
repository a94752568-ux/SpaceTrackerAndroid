/**
 * Favoritos v2: listas personalizadas + Radar Personalizado.
 *
 * Modelo de datos (persistido en localStorage `spacetracker:favorites:v2`):
 *   FavoritesState { lists: FavList[]; radarMode: boolean }
 *   FavList { id; name; icon; satIds: number[]; createdAt }
 *
 * Migración: si solo existe la clave v1 (`spacetracker:favorites:v1`, array de
 * NORAD), se migra a una lista por defecto "Favoritos" con esos ids. Estados
 * corruptos o ilegibles se descartan con estado vacío (nunca lanzan).
 *
 * Todas las operaciones son PURAS e INMUTABLES (devuelven un estado nuevo);
 * la persistencia la decide la capa React (App) tras cada cambio. Esto permite
 * testearlas sin DOM y reutilizarlas fuera de React.
 */

export interface FavList {
  id: string;
  name: string;
  /** Emoji/insignia de la lista (ver LIST_ICONS para las sugeridas en UI). */
  icon: string;
  /** Ids NORAD miembros (sin duplicados). */
  satIds: number[];
  createdAt: string;
}

export interface FavoritesState {
  lists: FavList[];
  /** Radar Personalizado: el mapa renderiza solo favoritos cuando es true. */
  radarMode: boolean;
}

export const LIST_ICONS: readonly string[] = ["★", "🛰️", "🚀", "📡", "🔬", "🛸", "🧭", "🌍"];
export const DEFAULT_LIST_NAME = "Favoritos";

const KEY_V2 = "spacetracker:favorites:v2";
const KEY_V1 = "spacetracker:favorites:v1";

/* ------------------------------------------------------------ construcción */

let seq = 0;
function newId(): string {
  seq += 1;
  return `l-${Date.now().toString(36)}-${seq.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function createListObj(name: string, icon: string = LIST_ICONS[0]): FavList {
  return {
    id: newId(),
    name: name.trim() || DEFAULT_LIST_NAME,
    icon: LIST_ICONS.includes(icon) ? icon : LIST_ICONS[0],
    satIds: [],
    createdAt: new Date().toISOString(),
  };
}

export function emptyState(): FavoritesState {
  return { lists: [createListObj(DEFAULT_LIST_NAME)], radarMode: false };
}

/** Migración desde el esquema v1 (array plano de NORAD). */
export function migrateFromV1(ids: number[]): FavoritesState {
  const s = emptyState();
  s.lists[0].satIds = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];
  return s;
}

/* ------------------------------------------------------------ persistencia */

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // sin almacenamiento (SSR, modo privado, Node en tests)
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

/** Validador defensivo: cualquier localStorage corrupto => null. */
export function sanitizeState(raw: unknown): FavoritesState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as { lists?: unknown; radarMode?: unknown };
  if (!Array.isArray(r.lists)) return null;
  const lists: FavList[] = [];
  for (const l of r.lists) {
    if (typeof l !== "object" || l === null) continue;
    const ll = l as { id?: unknown; name?: unknown; icon?: unknown; satIds?: unknown };
    if (typeof ll.id !== "string" || typeof ll.name !== "string" || !Array.isArray(ll.satIds)) {
      continue;
    }
    lists.push({
      id: ll.id,
      name: ll.name,
      icon: typeof ll.icon === "string" ? ll.icon : LIST_ICONS[0],
      satIds: ll.satIds.filter((n): n is number => Number.isInteger(n)),
      createdAt: typeof (ll as { createdAt?: unknown }).createdAt === "string"
        ? (ll as { createdAt: string }).createdAt
        : new Date().toISOString(),
    });
  }
  const state: FavoritesState = {
    lists,
    radarMode: typeof r.radarMode === "boolean" ? r.radarMode : false,
  };
  return ensureDefaultList(state);
}

export function loadFavoritesState(): FavoritesState {
  const v2 = safeGet(KEY_V2);
  if (v2) {
    try {
      const parsed = sanitizeState(JSON.parse(v2));
      if (parsed) return parsed;
    } catch {
      /* corrupto: continuar a migración/empty */
    }
  }
  const v1 = safeGet(KEY_V1);
  if (v1) {
    try {
      const ids = JSON.parse(v1);
      if (Array.isArray(ids)) return migrateFromV1(ids);
    } catch {
      /* corrupto: empty */
    }
  }
  return emptyState();
}

export function saveFavoritesState(s: FavoritesState): void {
  safeSet(KEY_V2, JSON.stringify(s));
}

/* ------------------------------------------------------- operaciones puras */

/** Garantiza al menos una lista (la app siempre tiene dónde guardar). */
export function ensureDefaultList(s: FavoritesState): FavoritesState {
  if (s.lists.length > 0) return s;
  return { ...s, lists: [createListObj(DEFAULT_LIST_NAME)] };
}

/** Nombre único: si existe, añade sufijo numérico ("Estaciones 2", "… 3"). */
function uniqueName(s: FavoritesState, name: string): string {
  const base = name.trim() || DEFAULT_LIST_NAME;
  const taken = new Set(s.lists.map((l) => l.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

export function createList(s: FavoritesState, name: string, icon?: string): FavoritesState {
  const list = createListObj(uniqueName(s, name), icon);
  return { ...s, lists: [...s.lists, list] };
}

export function renameList(s: FavoritesState, id: string, name: string): FavoritesState {
  const clean = name.trim();
  if (!clean) return s;
  return {
    ...s,
    lists: s.lists.map((l) => (l.id === id ? { ...l, name: clean } : l)),
  };
}

export function deleteList(s: FavoritesState, id: string): FavoritesState {
  return ensureDefaultList({ ...s, lists: s.lists.filter((l) => l.id !== id) });
}

/** Añade o quita (toggle) un satélite de una lista concreta. */
export function toggleSatInList(s: FavoritesState, listId: string, satId: number): FavoritesState {
  return {
    ...s,
    lists: s.lists.map((l) => {
      if (l.id !== listId) return l;
      const has = l.satIds.includes(satId);
      return {
        ...l,
        satIds: has ? l.satIds.filter((x) => x !== satId) : [...l.satIds, satId],
      };
    }),
  };
}

export function setRadarMode(s: FavoritesState, on: boolean): FavoritesState {
  return { ...s, radarMode: on };
}

/** Unión de ids de todas las listas (lo que pinta el radar / cuenta el badge). */
export function allFavoriteIds(s: FavoritesState): Set<number> {
  const out = new Set<number>();
  for (const l of s.lists) for (const id of l.satIds) out.add(id);
  return out;
}

export function listsContaining(s: FavoritesState, satId: number): string[] {
  return s.lists.filter((l) => l.satIds.includes(satId)).map((l) => l.id);
}
