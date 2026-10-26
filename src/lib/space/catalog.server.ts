/**
 * Servidor de catálogo: carga en vivo con caché, fallback al seed y mezcla
 * live+seed para cubrir grupos vacíos (Etapa 3: procedencia y fallback).
 */

import { GROUPS } from "./groups";
import {
  loadLiveCatalog,
  MIN_LIVE_SATS,
  type LoadLiveOptions,
} from "./load-catalog";
import { SEED_FETCHED_AT, SEED_SATS, SEED_STATS } from "./seed";
import type { CatalogPayload, GroupId, Sat } from "./types";

export const SEED_TOPUP_PER_GROUP = 4;
export const CACHE_TTL_MS = 15 * 60_000;

/**
 * Payload de respaldo con catálogo seed pre-validado.
 */
export function seedPayload(_now: Date = new Date(), extraNote?: string): CatalogPayload {
  const sats = SEED_SATS;
  const base = `Catálogo local (seed): ${sats.length} TLEs vigentes`;
  return {
    fetchedAt: SEED_FETCHED_AT,
    source: "seed",
    note: extraNote ? `${base} — ${extraNote}` : base,
    sats,
    stats: SEED_STATS,
  };
}

/**
 * Mezcla live+seed: deduplica por NORAD (live gana) y añade solo lo necesario
 * para que cada grupo con cero satélites live tenga hasta `perGroup` del seed.
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

export async function loadCatalogOnce(opts: LoadLiveOptions = {}): Promise<CatalogPayload> {
  const now = new Date();
  try {
    const live = await loadLiveCatalog(opts);
    const seedActive = SEED_SATS;
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

let cached: { atMs: number; payload: CatalogPayload } | null = null;
let inflight: Promise<CatalogPayload> | null = null;

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

export function peekCatalogCache(): { atMs: number; payload: CatalogPayload } | null {
  return cached;
}

export { MIN_LIVE_SATS, SEED_FETCHED_AT, SEED_SATS, SEED_STATS };
