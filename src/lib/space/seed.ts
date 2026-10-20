/**
 * Catálogo seed de respaldo: TLEs REALES descargados y validados el día indicado
 * en `SEED_FETCHED_AT` (generador: `npm run seed:generate` → scripts/generate-seed.mjs).
 *
 * Las estadísticas del seed se calculan con las MISMAS funciones reales que la
 * ingesta live (validateTle + diagnoseTleEpoch), congeladas en la fecha de
 * generación, para que el fallback tenga stats coherentes (Etapa 2, objetivo 4).
 */

import { filterActiveSatellites, type FilterRow } from "./tle-filter";
import type { CatalogStats, GroupId, Sat, SourceId } from "./types";

import seedJson from "./seed-data.json";

interface SeedRow {
  id: number;
  name: string;
  line1: string;
  line2: string;
  group: GroupId;
  source: SourceId;
}

const data = seedJson as unknown as {
  generatedAt: string;
  provenance: string;
  sats: SeedRow[];
};

/** ISO-8601 UTC del momento en que se generó el seed. */
export const SEED_FETCHED_AT: string = data.generatedAt;

/** Procedencia legible de los datos seed. */
export const SEED_PROVENANCE: string = data.provenance;

export const SEED_SATS: Sat[] = data.sats.map((r) => ({
  id: r.id,
  name: r.name,
  line1: r.line1,
  line2: r.line2,
  group: r.group,
}));

/** Filas del seed con procedencia, para el filtrado estricto por lote. */
export const SEED_ROWS: FilterRow[] = data.sats.map((r) => ({
  id: r.id,
  name: r.name,
  line1: r.line1,
  line2: r.line2,
  group: r.group,
  source: r.source,
}));

/**
 * Stats del seed calculadas con las MISMAS puertas estrictas que la ingesta
 * live (validateTle + época + caducidad + junk + viabilidad + decaimiento),
 * congeladas en `at` (por defecto la fecha de generación → deterministas).
 */
export function seedStats(at: Date = new Date(SEED_FETCHED_AT)): CatalogStats {
  return filterActiveSatellites(SEED_ROWS, { now: at }).stats;
}

export const SEED_STATS: CatalogStats = seedStats();
