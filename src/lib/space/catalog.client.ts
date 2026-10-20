/**
 * Cargador de catálogo para el NAVEGADOR.
 *
 * Estrategia en cascada (procedencia visible en `note`):
 * 1. `/api/catalog` (middleware de Vite en dev, o cualquier backend que sirva
 *    el payload de `catalog.server.ts`). Es la vía preferida: SatNOGS no tiene
 *    CORS y en el servidor se cachea.
 * 2. Sin servidor: ingesta directa desde el navegador usando SOLO Ivan
 *    (envía `Access-Control-Allow-Origin: *`; SatNOGS no) + compleción con
 *    seed para grupos vacíos.
 * 3. Si todo falla: seed local puro (`source: "seed"`).
 */

import { completeWithSeed, seedPayload } from "./catalog.server";
import { loadLiveCatalog } from "./load-catalog";
import type { CatalogPayload } from "./types";

export async function fetchCatalog(): Promise<CatalogPayload> {
  // 1) Servidor local
  try {
    const r = await fetch("/api/catalog", { signal: AbortSignal.timeout(25000) });
    if (r.ok) {
      const j = (await r.json()) as CatalogPayload;
      if (j && Array.isArray(j.sats) && j.sats.length > 0) return j;
    }
  } catch {
    // sin servidor o payload inválido: seguir a la cascada
  }

  // 2) Ivan directo desde el navegador (CORS *), sin SatNOGS (sin CORS);
  //    el seed que completa grupos vacíos pasa también el filtro estricto.
  try {
    const live = await loadLiveCatalog({ includeSatnogs: false, budgetMs: 9000 });
    const seedActive = seedPayload(new Date()).sats;
    const { sats, addedFromSeed, groupsTopped } = completeWithSeed(live.sats, seedActive);
    const parts = [
      `live (navegador, solo Ivan): ${live.sats.length} satélites únicos`,
    ];
    if (addedFromSeed > 0) {
      parts.push(`+${addedFromSeed} del seed (${groupsTopped.join(", ")})`);
    }
    return {
      fetchedAt: new Date().toISOString(),
      source: "live",
      note: [...parts, ...live.notes, "SatNOGS omitido en navegador (sin CORS)"].join(" · "),
      sats,
      stats: live.stats,
    };
  } catch {
    // 3) Seed local (con filtro estricto de caducidad aplicado)
    return seedPayload(new Date(), "no se pudieron cargar fuentes en vivo desde el navegador");
  }
}
