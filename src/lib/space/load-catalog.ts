/**
 * Ingesta de catálogo orbital desde fuentes externas.
 *
 * Fuentes (verificadas el 2026-10-18):
 * - Ivan Stanojevic: https://tle.ivanstanojevic.me/api/tle/  (Hydra/JSON-LD;
 *   `?search=` funciona; `?page=` responde 508 "Resource Limit" con HTML;
 *   cabecera CORS `*`; límite de recursos agresivo → reintento con backoff).
 * - SatNOGS: https://db.satnogs.org/api/tle/?format=json  (array JSON; SIN
 *   cabeceras CORS → en navegador solo funciona vía servidor/middleware).
 *
 * Semántica de contadores (Etapa 2, ver comentario en types.ts):
 * - seen/seenBySource: filas recibidas.
 * - valid/bySource: candidatos ACEPTADOS (estructura + época + junk + consulta).
 * - fresh/aging/stale: contados SOLO sobre aceptados → invariante
 *   `fresh + aging + stale === valid`.
 * - invalid: filas con estructura/época ilegibles (nunca fallos de red).
 * - future: filas rechazadas por época futura.
 * - failedBySource: PETICIONES fallidas. Regla única anti-duplicado (F4):
 *   cada petición fallida se cuenta UNA vez, dentro del catch de la función de
 *   fuente propietaria de la petición; los workers/agregadores NO vuelven a
 *   contar. Un timeout/abort global cuenta como fallo de cada petición en vuelo.
 */

import { accept, groupOf, IVAN_QUERIES, junk } from "./groups";
import { countReject, emptyStats, gateRow, type FilterRow } from "./tle-filter";
import { hasValidTleEpoch } from "./tle-epoch";
import { validateTle } from "./tle-validation";
import type { CatalogStats, GroupId, Sat, SourceId } from "./types";

export const IVAN_BASE = "https://tle.ivanstanojevic.me/api/tle/";
export const SATNOGS_URL = "https://db.satnogs.org/api/tle/?format=json";
export const MIN_LIVE_SATS = 8;
export const DEFAULT_BUDGET_MS = 7500;

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Error de nivel PETICIÓN (red, timeout/abort, HTTP != 2xx, cuerpo no-JSON). */
export class SourceRequestError extends Error {}

/* Filas tal como las devuelve cada API (campos verificados en vivo). */
export interface IvanRow {
  satelliteId: number;
  name: string;
  line1: string;
  line2: string;
}
export interface SatnogsRow {
  tle0: string;
  tle1: string;
  tle2: string;
  norad_cat_id: number;
}

export function createStats(): CatalogStats {
  return emptyStats();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 508 || (status >= 500 && status <= 599);
}

/** fetch con reintentos ante red/429/5xx/508; NO reintenta si la señal ya abortó. */
async function fetchWithRetry(
  url: string,
  opts: {
    fetchImpl: FetchLike;
    signal?: AbortSignal;
    tries?: number;
    backoffMs?: number;
    label: string;
  },
): Promise<Response> {
  const tries = opts.tries ?? 2;
  const backoffMs = opts.backoffMs ?? 500;
  let lastErr = "sin intento";
  for (let attempt = 0; attempt < tries; attempt++) {
    if (opts.signal?.aborted) break;
    try {
      const res = await opts.fetchImpl(url, { signal: opts.signal });
      if (res.ok) return res;
      lastErr = `HTTP ${res.status}`;
      void res.body?.cancel().catch(() => undefined);
      if (!isRetryableStatus(res.status)) break;
    } catch (e) {
      if (opts.signal?.aborted) break;
      lastErr = e instanceof Error ? e.message : String(e);
    }
    if (attempt < tries - 1) await sleep(backoffMs * (attempt + 1));
  }
  if (opts.signal?.aborted) {
    throw new SourceRequestError(`${opts.label}: petición abortada (timeout/presupuesto)`);
  }
  throw new SourceRequestError(`${opts.label}: fallo de petición (${lastErr})`);
}

/** Lee JSON exigiendo 2xx y content-type JSON (el 508 de Ivan llega como HTML). */
async function readJson(res: Response, label: string): Promise<unknown> {
  if (!res.ok) {
    throw new SourceRequestError(`${label}: HTTP ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) {
    throw new SourceRequestError(
      `${label}: respuesta no-JSON (HTTP ${res.status}, content-type '${ct || "ausente"}')`,
    );
  }
  try {
    return await res.json();
  } catch {
    throw new SourceRequestError(`${label}: JSON inválido`);
  }
}

interface RowLike {
  id?: number | string;
  name?: string;
  line1?: string;
  line2?: string;
}

/**
 * Procesa UNA fila aplicando la puerta estricta de `tle-filter.gateRow`
 * (checksum → época → caducidad 30 d → junk → viabilidad → decaimiento).
 * Los rechazos se contabilizan por razón; solo los aceptados suman a
 * fresh/aging/stale + valid + bySource ⇒ invariante con `valid`.
 * Devuelve el candidato aceptado o null.
 */
function processRow(
  raw: RowLike,
  opts: { source: SourceId; query?: string; groupHint?: GroupId; stats?: CatalogStats; now: Date },
): Sat | null {
  const { stats } = opts;
  const name = (raw.name ?? "").trim();
  const row: FilterRow = {
    id: raw.id as number | string,
    name,
    line1: raw.line1 ?? "",
    line2: raw.line2 ?? "",
    source: opts.source,
  };
  // Filtro de consulta (búsqueda): fuera de consulta no contabiliza en nada.
  if (opts.query && opts.query.trim().length > 0 && !name.toUpperCase().includes(opts.query.trim().toUpperCase())) {
    return null;
  }
  const g = gateRow(row, { now: opts.now });
  if (!g.ok) {
    if (stats) countReject(stats, g.reason);
    return null;
  }
  if (stats) {
    stats[g.bucket]++;
    stats.valid++;
    stats.bySource[opts.source]++;
  }
  const id = Number(raw.id);
  return {
    id,
    name,
    line1: row.line1,
    line2: row.line2,
    group: opts.groupHint && groupOf(name) === "other" ? opts.groupHint : groupOf(name),
  };
}

/**
 * Búsqueda en Ivan. `group` es la pista de grupo de la consulta (opcional).
 * Si la petición falla (red/abort/508 HTML/…), cuenta UN fallo en
 * `failedBySource.ivan` y relanza; el worker que la llame NO debe recontar.
 */
export async function ivanSearch(
  query: string,
  group?: GroupId,
  signal?: AbortSignal,
  stats?: CatalogStats,
  fetchImpl: FetchLike = (u, i) => fetch(u, i),
  now: Date = new Date(),
): Promise<Sat[]> {
  const url = `${IVAN_BASE}?search=${encodeURIComponent(query)}`;
  try {
    const res = await fetchWithRetry(url, { fetchImpl, signal, tries: 2, backoffMs: 600, label: "Ivan" });
    const json = (await readJson(res, "Ivan")) as { member?: IvanRow[] };
    if (!Array.isArray(json?.member)) {
      throw new SourceRequestError("Ivan: respuesta sin la lista 'member'");
    }
    const out: Sat[] = [];
    for (const row of json.member) {
      if (stats) {
        stats.seen++;
        stats.seenBySource.ivan++;
      }
      const sat = processRow(
        { id: row.satelliteId, name: row.name, line1: row.line1, line2: row.line2 },
        { source: "ivan", query, groupHint: group, stats, now },
      );
      if (sat) out.push(sat);
    }
    return out;
  } catch (e) {
    if (stats) stats.failedBySource.ivan++; // regla única: se cuenta aquí, una vez
    throw e instanceof SourceRequestError ? e : new SourceRequestError(`Ivan: ${String(e)}`);
  }
}

/** TLE por ID NORAD en Ivan (para búsqueda numérica). No toca stats. */
export async function ivanById(
  id: number,
  signal?: AbortSignal,
  fetchImpl: FetchLike = (u, i) => fetch(u, i),
  now: Date = new Date(),
): Promise<Sat | null> {
  const res = await fetchWithRetry(`${IVAN_BASE}${id}`, {
    fetchImpl,
    signal,
    tries: 2,
    backoffMs: 600,
    label: "Ivan",
  });
  const row = (await readJson(res, "Ivan")) as IvanRow;
  if (!row || typeof row.satelliteId !== "number") return null;
  if (!validateTle(row.satelliteId, row.line1, row.line2).valid) return null;
  if (!hasValidTleEpoch(row.line1, now)) return null;
  return {
    id: row.satelliteId,
    name: (row.name ?? "").trim(),
    line1: row.line1,
    line2: row.line2,
    group: groupOf(row.name ?? ""),
  };
}

/**
 * Volcado de SatNOGS. Filtra junk y clasifica por nombre (la API no trae
 * categorías: `norad_cat_id` es el ID NORAD, verificado).
 * Si la petición falla, cuenta UN fallo en `failedBySource.satnogs` y relanza.
 */
export async function satnogs(
  signal?: AbortSignal,
  stats?: CatalogStats,
  fetchImpl: FetchLike = (u, i) => fetch(u, i),
  now: Date = new Date(),
): Promise<Sat[]> {
  try {
    const res = await fetchWithRetry(SATNOGS_URL, {
      fetchImpl,
      signal,
      tries: 2,
      backoffMs: 600,
      label: "SatNOGS",
    });
    const json = (await readJson(res, "SatNOGS")) as SatnogsRow[];
    if (!Array.isArray(json)) {
      throw new SourceRequestError("SatNOGS: respuesta sin array de filas");
    }
    const out: Sat[] = [];
    for (const row of json) {
      if (stats) {
        stats.seen++;
        stats.seenBySource.satnogs++;
      }
      const name = (row.tle0 ?? "").replace(/^0 /, "").trim();
      const sat = processRow(
        { id: row.norad_cat_id, name, line1: row.tle1, line2: row.tle2 },
        { source: "satnogs", stats, now },
      );
      if (sat) out.push(sat);
    }
    return out;
  } catch (e) {
    if (stats) stats.failedBySource.satnogs++; // regla única: se cuenta aquí, una vez
    throw e instanceof SourceRequestError ? e : new SourceRequestError(`SatNOGS: ${String(e)}`);
  }
}

export interface LoadLiveOptions {
  /** Presupuesto total en ms (por defecto 7500, como el proyecto original). */
  budgetMs?: number;
  fetchImpl?: FetchLike;
  now?: Date;
  /** Consultas de Ivan (por defecto IVAN_QUERIES). */
  queries?: readonly { q: string; group: GroupId }[];
  /** Permitir desactivar SatNOGS (modo navegador: no tiene CORS). */
  includeSatnogs?: boolean;
  /** Concurrentes de Ivan (por defecto 4). */
  ivanConcurrency?: number;
}

export interface LiveCatalog {
  sats: Sat[];
  stats: CatalogStats;
  notes: string[];
}

async function runPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const n = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: n }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Carga el catálogo en vivo: SatNOGS + workers paralelos de Ivan bajo un
 * presupuesto común (AbortController). Exige >= MIN_LIVE_SATS únicos; si no,
 * lanza `No se pudo descargar el catálogo orbital` (mensaje canónico).
 */
export async function loadLiveCatalog(opts: LoadLiveOptions = {}): Promise<LiveCatalog> {
  const budgetMs = opts.budgetMs ?? DEFAULT_BUDGET_MS;
  const now = opts.now ?? new Date();
  const fetchImpl = opts.fetchImpl ?? ((u, i) => fetch(u, i));
  const queries = opts.queries ?? IVAN_QUERIES;
  const stats = createStats();
  const notes: string[] = [];

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), budgetMs);
  try {
    const satnogsTask = (async (): Promise<Sat[]> => {
      if (opts.includeSatnogs === false) return [];
      try {
        return await satnogs(ac.signal, stats, fetchImpl, now);
      } catch {
        notes.push("SatNOGS no respondió");
        return [];
      }
    })();

    const ivanTask = runPool(queries, opts.ivanConcurrency ?? 4, async ({ q, group }) => {
      try {
        return await ivanSearch(q, group, ac.signal, stats, fetchImpl, now);
      } catch {
        return null; // el fallo YA está contado en ivanSearch (regla única F4)
      }
    });

    const [satnogsSats, ivanParts] = await Promise.all([satnogsTask, ivanTask]);

    if (ac.signal.aborted) {
      notes.push(`Presupuesto de ${budgetMs} ms agotado: catálogo parcial`);
    }
    if (stats.failedBySource.ivan > 0) {
      notes.push(`Ivan: ${stats.failedBySource.ivan} peticiones fallidas`);
    }

    // Deduplicación por NORAD: Ivan primero (consultas curadas), luego SatNOGS.
    const byId = new Map<number, Sat>();
    for (const part of ivanParts) {
      for (const s of part ?? []) if (!byId.has(s.id)) byId.set(s.id, s);
    }
    for (const s of satnogsSats) if (!byId.has(s.id)) byId.set(s.id, s);

    const sats = [...byId.values()].sort(
      (a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name),
    );

    if (sats.length < MIN_LIVE_SATS) {
      throw new Error("No se pudo descargar el catálogo orbital");
    }
    return { sats, stats, notes };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Búsqueda por nombre o número NORAD (para la caja de búsqueda de la UI).
 * Numérico → Ivan por ID; texto → Ivan search filtrado por `accept`.
 */
export async function searchSatsByName(
  query: string,
  signal?: AbortSignal,
  opts: { fetchImpl?: FetchLike; now?: Date } = {},
): Promise<Sat[]> {
  const q = query.trim();
  if (!q) return [];
  const fetchImpl = opts.fetchImpl ?? ((u, i) => fetch(u, i));
  const now = opts.now ?? new Date();
  if (/^\d{1,5}$/.test(q)) {
    try {
      const sat = await ivanById(Number(q), signal, fetchImpl, now);
      return sat ? [sat] : [];
    } catch {
      return [];
    }
  }
  try {
    return await ivanSearch(q, undefined, signal, undefined, fetchImpl, now);
  } catch {
    return [];
  }
}

// Re-exportaciones útiles para la UI y los tests.
export { accept, groupOf, junk };
export { hasValidTleEpoch };
