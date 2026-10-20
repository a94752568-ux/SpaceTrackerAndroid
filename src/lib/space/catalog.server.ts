/**
 * Servidor de catálogo: carga en vivo con caché, fallback al seed y mezcla
 * live+seed para cubrir grupos vacíos (Etapa 3: procedencia y fallback).
 *
 * Se consume:
 * - En dev: vía middleware `/api/catalog` de Vite (vite.config.ts) con
 *   `ssrLoadModule`, igual que el proyecto original.
 * - En tests: directamente con `fetchImpl` inyectado (funciones REALES, sin
 *   reimplementar lógica en el test — requisito de Etapa 4).
 *
 * Reglas de merge/fallback (no cambiar sin tests específicos):
 * 1. Live OK → source "live"; se completa con seed SOLO para grupos con cero
 *    cobertura live (máx. SEED_TOPUP_PER_GROUP por grupo); el satélite live
 *    manda sobre el seed con el mismo NORAD.
 * 2. Live KO (fuentes caídas o < MIN_LIVE_SATS) → source "seed" con
 *    SEED_FETCHED_AT y SEED_STATS congelados en la fecha de generación.
 * 3. `stats` describe SIEMPRE la ingesta live (procedencia auditables en
 *    `note`); los satélites añadidos del seed se anotan explícitamente.
 */

import { GROUPS } from "./groups";
import {
  loadLiveCatalog,
  MIN_LIVE_SATS,
  type LoadLiveOptions,
} from "./load-catalog";
import { SEED_FETCHED_AT, SEED_ROWS, SEED_SATS, SEED_STATS } from "./seed";
import { filterActiveSatellites } from "./tle-filter";
import type { CatalogPayload, GroupId, Sat } from "./types";

export const SEED_TOPUP_PER_GROUP = 4;
export const CACHE_TTL_MS = 15 * 60_000;

/**
 * Payload de respaldo con FILTRO ESTRICTO en tiempo de carga: si el seed ha
 * envejecido más que el umbral (30 d), sus TLEs caducados se descartan aquí
 * también (el seed nunca inyecta órbitas erráticas en el mapa/worker).
 */
export function seedPayload(now: Date = new Date(), extraNote?: string): CatalogPayload {
  const { sats, stats } = filterActiveSatellites(SEED_ROWS, { now });
  const base =
    sats.length === 0
      ? `Catálogo seed EXPIRADO (>30 d): regenera con \`npm run seed:generate\``
      : `Catálogo local (seed): ${sats.length}/${SEED_ROWS.length} TLEs vigentes`;
  return {
    fetchedAt: SEED_FETCHED_AT,
    source: "seed",
    note: extraNote ? `${base} — ${extraNote}` : base,
    sats,
    stats,
  };
}

/**
 * Mezcla live+seed: deduplica por NORAD (live gana) y añade solo lo necesario
 * para que cada grupo con cero satélites live tenga hasta `perGroup` del seed.
 * Función pura.
 */
export function completeWithSeed(
  live: Sat[],
  seed: Sat[],
  perGroup: number = SEED_TOPUP_PER_GROUP,
): { sats: Sat[]; addedFromSeed: number; groupsTopped: GroupId[] } {
  const have = new Set(live.map((s) => s.id));
  const liveCount = new Map<GroupId, number>();
  for (const s of live) liveCount.set(s.group, (liveCount.get(s.group) ?? 0) + 1);

  const extra: Sat[] = [];
  const groupsTopped: GroupId[] = [];
  for (const g of GROUPS) {
    if ((liveCount.get(g) ?? 0) > 0) continue;
    let n = 0;
    for (const s of seed) {
      if (n >= perGroup) break;
      if (s.group === g && !have.has(s.id)) {
        extra.push(s);
        have.add(s.id);
        n++;
      }
    }
    if (n > 0) groupsTopped.push(g);
  }
  return { sats: [...live, ...extra], addedFromSeed: extra.length, groupsTopped };
}

/** Merge genérico live+seed (live gana por NORAD). Función pura. */
export function mergeCatalogs(
  live: Sat[],
  seed: Sat[],
): { sats: Sat[]; addedFromSeed: number } {
  const byId = new Map<number, Sat>();
  for (const s of live) byId.set(s.id, s);
  let added = 0;
  for (const s of seed) {
    if (!byId.has(s.id)) {
      byId.set(s.id, s);
      added++;
    }
  }
  return { sats: [...byId.values()], addedFromSeed: added };
}

function sortSats(sats: Sat[]): Sat[] {
  return [...sats].sort(
    (a, b) =>
      GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || a.name.localeCompare(b.name),
  );
}

/** Carga una vez (sin caché): live con compleción de seed, o fallback seed. */
export async function loadCatalogOnce(opts: LoadLiveOptions = {}): Promise<CatalogPayload> {
  const now = new Date();
  try {
    const live = await loadLiveCatalog(opts);
    // El seed que completa grupos vacíos también pasa el filtro estricto.
    const seedActive = filterActiveSatellites(SEED_ROWS, { now }).sats;
    const { sats, addedFromSeed, groupsTopped } = completeWithSeed(live.sats, seedActive);
    const parts = [
      `live: ${live.sats.length} satélites únicos (Ivan ${live.stats.bySource.ivan}, SatNOGS ${live.stats.bySource.satnogs}; vistos ${live.stats.seen}, expirados ${live.stats.expired}, decaídos ${live.stats.decayed})`,
    ];
    if (addedFromSeed > 0) {
      parts.push(`+${addedFromSeed} del seed para cubrir grupos sin cobertura (${groupsTopped.join(", ")})`);
    }
    return {
      fetchedAt: now.toISOString(),
      source: "live",
      note: [...parts, ...live.notes].join(" · "),
      sats: sortSats(sats),
      stats: live.stats,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return seedPayload(now, msg);
  }
}

/* ------------------------------------------------------------- caché SSR */

let cached: { atMs: number; payload: CatalogPayload } | null = null;
let inflight: Promise<CatalogPayload> | null = null;

/**
 * Catálogo con caché (TTL 15 min) y deduplicación de peticiones concurrentes.
 * Es la función que sirve el middleware `/api/catalog`.
 */
export async function getCatalog(opts: LoadLiveOptions = {}): Promise<CatalogPayload> {
  const nowMs = Date.now();
  if (cached && nowMs - cached.atMs < CACHE_TTL_MS) return cached.payload;
  if (!inflight) {
    inflight = loadCatalogOnce(opts)
      .then((payload) => {
        cached = { atMs: Date.now(), payload };
        return payload;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function invalidateCatalogCache(): void {
  cached = null;
}

/** Solo diagnóstico/tests. */
export function peekCatalogCache(): { atMs: number; payload: CatalogPayload } | null {
  return cached;
}

export { MIN_LIVE_SATS, SEED_FETCHED_AT, SEED_SATS, SEED_STATS };
