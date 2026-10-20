/**
 * Clasificación por nombre: grupos de misión, filtro anti-basura (`junk`)
 * y filtro de aceptación (`accept`).
 *
 * Nota de datos (verificado el 2026-10-18): la API de SatNOGS
 * (`/api/tle/?format=json`) NO expone categorías — su campo `norad_cat_id` es
 * el ID NORAD del satélite, no una categoría. Por eso la agrupación se hace
 * por patrones de nombre en ambas fuentes.
 */

import type { GroupId } from "./types";

export const GROUPS: readonly GroupId[] = [
  "crew",
  "weather",
  "nav",
  "science",
  "starlink",
  "comms",
  "other",
] as const;

export const GROUP_LABELS: Record<GroupId, string> = {
  crew: "Tripulados",
  weather: "Meteorología",
  nav: "Navegación",
  science: "Ciencia y observación",
  starlink: "Starlink",
  comms: "Comunicaciones",
  other: "Otros",
};

interface Pattern {
  group: GroupId;
  re: RegExp;
}

/** Orden significativo: primero la coincidencia más específica gana. */
const PATTERNS: Pattern[] = [
  { group: "crew", re: /\bISS\b|ZARYA|TIANHE|WENTIAN|MENGTIAN|SHENZHOU|TIANZHOU|\bCSS\b|CREW[- ]?\d|DRAGON/i },
  { group: "starlink", re: /^STARLINK|\bSTARLINK\b/i },
  { group: "nav", re: /\bGPS\b|NAVSTAR|GALILEO|GLONASS|BEIDOU|\bQZSS\b|MICHIBIKI|IRNSS|NAVIC/i },
  { group: "weather", re: /^NOAA|\bNOAA\b|\bGOES\b|METEOSAT|\bMSG\b|METOP|FENGYUN|HIMAWARI|MTSAT|\bTERRA\b|\bAQUA\b|SUOMI|\bNPP\b|\bJPSS\b|METEOR[- ]M|\bELEKTRO\b|\bSARAL\b|CLOUDSAT|CALIPSO|\bSWOT\b|JASON|CRYOSAT|\bSMOS\b|\bAURA\b|GOSAT|\bGPM\b|CYGNES/i },
  { group: "science", re: /HUBBLE|\bHST\b|\bJWST\b|JAMES WEBB|\bTESS\b|CHANDRA|FERMI|SWIFT|\bXMM\b|\bGAIA\b|INTEGRAL|NUSTAR|\bIXPE\b|EUCLID|SENTINEL|LANDSAT|\bSPEKTR\b|\bLUCAS\b|\bAIM\b|\bODIN\b|\bSMAP\b|\bPACE\b/i },
  { group: "comms", re: /INTELSAT|\bSES[- ]?\d|\bASTRA\b|EUTELSAT|IRIDIUM|GLOBALSTAR|ONEWEB|INMARSAT|THURAYA|TELSTAR|\bANIK\b|\bAMOS[- ]?\d|HISPASAT|TURKSAT|ARABSAT|\bYAMAL\b|\bLUCH\b|\bTDRS\b|ECHOSTAR|SIRIUSXM|NILESAT|THAICOM|\bAPSTAR\b|\bVIASAT\b|\bJUPITER\b|\bOPTUS\b|SKY MUSTER|AZERSPACE|BELINTERSAT|EXPRESS-|\bGALAXY\b|\bMEASAT\b|\bJCSAT\b|KOREASAT|NIMIQ|STAR ONE|\bABS[- ]?\d|\bBADR\b|\bYAMAL\b/i },
];

/** Devuelve el grupo por patrones de nombre; `other` si nada coincide. */
export function groupOf(name: string): GroupId {
  const upper = (name || "").toUpperCase();
  for (const p of PATTERNS) {
    if (p.re.test(upper)) return p.group;
  }
  return "other";
}

/**
 * Nombres de basura orbital y cuerpos de cohete que NO deben entrar al catálogo:
 * debris (`DEB`), cuerpos de cohete (`R/B`), designadores internacionales crudos
 * (`1998-067B`), entradas `OBJECT X` y nombres vacíos/numéricos.
 */
export function junk(name: string): boolean {
  const n = (name || "").trim().toUpperCase();
  if (n.length === 0) return true;
  if (/^\d+$/.test(n)) return true;
  if (/\bDEB\b|\bDEBRIS\b/.test(n)) return true;
  if (/\bR\/B\b/.test(n)) return true;
  if (/^OBJECT [A-Z0-9]/.test(n)) return true;
  if (/^\d{4}-\d{3}[A-Z]?\b/.test(n)) return true;
  if (/^\d{4}-\d{2,}[A-Z]*\s*$/.test(n)) return true;
  if (/\bBOLTOPH\b|\bNORAD\b/.test(n) && /\bDEB\b/.test(n)) return true;
  return false;
}

/**
 * Acepta un nombre para el catálogo:
 * - nunca basura;
 * - si hay consulta, el nombre debe contenerla (subcadena, sin distinción de
 *   mayúsculas) — la búsqueda por NORAD se resuelve aparte en load-catalog.
 */
export function accept(name: string, query?: string): boolean {
  if (junk(name)) return false;
  if (query && query.trim().length > 0) {
    const q = query.trim().toUpperCase();
    if (!name.toUpperCase().includes(q)) return false;
  }
  return true;
}

/**
 * Consultas paralelas hacia la API de Ivan para poblar el catálogo por grupos.
 * Cada consulta devuelve como máximo una página (20 filas); sin `?page=`
 * porque Ivan responde 508 (límite de recursos) a la paginación — verificado.
 */
export const IVAN_QUERIES: readonly { q: string; group: GroupId }[] = [
  { q: "ISS", group: "crew" },
  { q: "STARLINK", group: "starlink" },
  { q: "GPS", group: "nav" },
  { q: "GALILEO", group: "nav" },
  { q: "GLONASS", group: "nav" },
  { q: "NOAA", group: "weather" },
  { q: "GOES", group: "weather" },
  { q: "METEOSAT", group: "weather" },
  { q: "FENGYUN", group: "weather" },
  { q: "HUBBLE", group: "science" },
  { q: "SENTINEL", group: "science" },
  { q: "TDRS", group: "comms" },
  { q: "INTELSAT", group: "comms" },
  { q: "ONEWEB", group: "comms" },
];
