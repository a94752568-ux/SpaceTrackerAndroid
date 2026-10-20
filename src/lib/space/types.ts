/**
 * SpaceTracker — tipos del dominio orbital y de catálogo.
 *
 * Convención de unidades en todo el código propio:
 * - Ángulos expuestos en la UI: GRADOS (los internos de satellite.js son radianes).
 * - Distancias: km. Velocidades: km/s. Tiempos: epoch ms o ISO-8601 UTC.
 */

export type GroupId =
  | "crew"
  | "weather"
  | "nav"
  | "science"
  | "starlink"
  | "comms"
  | "other";

export type SourceId = "ivan" | "satnogs";

/** Estado del diagnóstico de época TLE. */
export type EpochStatus = "fresh" | "aging" | "stale" | "future" | "invalid";

export interface Sat {
  /** Número de catálogo NORAD. */
  id: number;
  name: string;
  line1: string;
  line2: string;
  group: GroupId;
}

/**
 * Métricas de ingesta del catálogo (Etapa 2 corregida).
 *
 * Semántica OBLIGATORIA de cada contador:
 * - `seen`: filas TLE recibidas de todas las fuentes (=== suma de `seenBySource`).
 * - `seenBySource`: filas recibidas por fuente.
 * - `valid`: candidatos ACEPTADOS (pasan validación estructural TLE, época no
 *   futura ni inválida, filtro anti-basura `junk()` y filtro de grupo/consulta).
 *   NO está deduplicado: para satélites únicos usar `CatalogPayload.sats.length`.
 * - `bySource`: candidatos aceptados por fuente (mismo criterio que `valid`).
 * - `fresh` / `aging` / `stale`: distribución de época CONTADA SOBRE EL MISMO
 *   conjunto que `valid` (solo aceptados). Invariante:
 *   `fresh + aging + stale === valid`.
 * - `invalid`: filas que fallaron la validación estructural TLE o cuya época es
 *   ilegible/ilegal (distinto de `future`).
 * - `future`: filas rechazadas por época futura (la ingesta las descarta).
 * - `expired`: filas descartadas por época más antigua que el umbral estricto
 *   (`MAX_TLE_AGE_DAYS = 30`): nunca entran al catálogo ni al worker SGP4.
 * - `junk`: filas descartadas por nombre de debris/basura orbital (no cuentan
 *   como inválidas).
 * - `implausible`: órbitas matemáticamente inviables (mov. medio o
 *   excentricidad fuera de rango terrestre).
 * - `decayed`: objetos reingresados/decaídos confirmados por SGP4
 *   (`checkForDecay` de satellite.js 7.1.0).
 * - `failedBySource`: PETICIONES HTTP fallidas por fuente (error de red, timeout,
 *   abort, estado != 2xx, o cuerpo no-JSON p. ej. el 508 HTML de Ivan).
 *   Jamás confundir con filas inválidas. Un timeout/abort global cuenta una vez
 *   por petición fallida, sin duplicar el mismo error en dos contadores.
 */
export interface CatalogStats {
  seen: number;
  valid: number;
  fresh: number;
  aging: number;
  stale: number;
  future: number;
  invalid: number;
  junk: number;
  expired: number;
  implausible: number;
  decayed: number;
  bySource: { satnogs: number; ivan: number };
  seenBySource: { satnogs: number; ivan: number };
  failedBySource: { satnogs: number; ivan: number };
}

/** Datos del observador terrestre. */
export interface Observer {
  name: string;
  /** País opcional (texto libre). */
  country?: string;
  /** Grados, norte positivo. */
  latitude: number;
  /** Grados, este positivo. */
  longitude: number;
  /** Zona horaria IANA, p. ej. "Europe/Madrid". */
  timezone: string;
  /** Metros sobre el nivel del mar (opcional). */
  elevationM?: number;
}

/** Payload de catálogo con procedencia. */
export interface CatalogPayload {
  /** ISO-8601 UTC del momento de obtención. */
  fetchedAt: string;
  source: "live" | "seed";
  /** Nota legible sobre la procedencia (caídas parciales, mezcla con seed…). */
  note?: string;
  sats: Sat[];
  stats?: CatalogStats;
}

/** Resultado de búsqueda de lugares (para el observador). */
export interface PlaceHit {
  name: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone: string;
  elevationM?: number;
}

/** Muestra de posición/estado del satélite en un instante. */
export interface Fix {
  tMs: number;
  latDeg: number;
  lonDeg: number;
  altKm: number;
  velKmS: number;
}

/** Estado "ahora" para cabecera/pronóstico inmediato. */
export interface ForecastNow {
  iso: string;
  latDeg: number;
  lonDeg: number;
  altKm: number;
  velKmS: number;
  /** Ángulos respecto al observador, si está definido. */
  azDeg?: number;
  elDeg?: number;
  rangeKm?: number;
  /** true si el satélite está iluminado por el Sol (sombra = 0). */
  sunlit: boolean;
  shadowFraction: number;
}

/** Paso visible sobre el observador. */
export interface Pass {
  /** Adquisición de señal (inicio del paso), epoch ms UTC. */
  aosMs: number;
  /** Instante de máxima elevación, epoch ms UTC. */
  tcaMs: number;
  /** Pérdida de señal (fin del paso), epoch ms UTC. */
  losMs: number;
  maxElDeg: number;
  azRiseDeg: number;
  azSetDeg: number;
  durationMin: number;
}
