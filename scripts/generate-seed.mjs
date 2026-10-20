/**
 * Generador del catálogo seed (datos REALES).
 *
 * Descarga TLEs de SatNOGS (volcado completo) y de la API de Ivan (búsquedas
 * concretas con reintento/backoff porque Ivan responde 508 bajo presión),
 * los valida con las funciones REALES del proyecto (validateTle,
 * diagnoseTleEpoch, groupOf/junk) y escribe src/lib/space/seed-data.json.
 *
 * Ejecutar: npm run seed:generate
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkForDecay, propagate, twoline2satrec } from "satellite.js";

import { closeVite, loadModule } from "./_load.mjs";

const OUT = fileURLToPath(new URL("../src/lib/space/seed-data.json", import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { validateTle } = await loadModule("/src/lib/space/tle-validation.ts");
const { diagnoseTleEpoch } = await loadModule("/src/lib/space/tle-epoch.ts");
const { groupOf, junk, GROUPS } = await loadModule("/src/lib/space/groups.ts");

const now = new Date();

function tleOk(id, line1, line2) {
  const v = validateTle(id, line1, line2);
  if (!v.valid) return { ok: false, why: v.errors.join("; ") };
  const d = diagnoseTleEpoch(line1, now);
  if (d.status === "future" || d.status === "invalid") return { ok: false, why: d.reason ?? d.status };
  // Umbral estricto de caducidad idéntico al de la ingesta (30 d): el seed
  // nace ya dentro de la ventana para que seedStats() y gateRow coincidan.
  if ((d.ageDays ?? 0) > 30) return { ok: false, why: `época de ${(d.ageDays ?? 0).toFixed(1)} d > 30 d` };
  // Puerta de propagación: el seed nunca debe contener TLEs que SGP4 rechace
  // o que el community decay check marque como reingresados.
  try {
    const rec = twoline2satrec(line1, line2);
    const pv = propagate(rec, now, { communityDecayCheckEnabled: true });
    if (!pv || checkForDecay(rec)) return { ok: false, why: "no propaga / decaído (SGP4)" };
  } catch {
    return { ok: false, why: "SGP4 lanzó excepción" };
  }
  return { ok: true, epochStatus: d.status };
}

async function fetchJson(url, { tries = 4, backoffMs = 1200 } = {}) {
  let lastErr = "sin intento";
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const ct = r.headers.get("content-type") || "";
      if (r.ok && ct.includes("json")) return await r.json();
      lastErr = `HTTP ${r.status} (${ct || "sin content-type"})`;
    } catch (e) {
      lastErr = e.cause?.code || e.message;
    }
    await sleep(backoffMs * (i + 1)); // 508 de Ivan = límite temporal; reintentar con calma
  }
  throw new Error(`fallo tras ${tries} intentos: ${lastErr}`);
}

const picks = []; // { id, name, line1, line2, source }
const seenIds = new Set();

function add(id, name, line1, line2, source) {
  if (seenIds.has(id)) return false;
  if (!name || junk(name)) return false;
  const chk = tleOk(id, line1, line2);
  if (!chk.ok) {
    console.log(`  descartado ${name} (${id}): ${chk.why}`);
    return false;
  }
  seenIds.add(id);
  picks.push({ id, name, line1, line2, source, epochStatus: chk.epochStatus });
  return true;
}

/* --- 1) Volcado de SatNOGS --- */
console.log("Descargando SatNOGS…");
let satnogsRows = [];
try {
  satnogsRows = await fetchJson("https://db.satnogs.org/api/tle/?format=json");
  console.log(`  ${satnogsRows.length} filas`);
} catch (e) {
  console.log("  SatNOGS no disponible:", e.message);
}

const WANTED = [
  /^ISS \(ZARYA\)$/, /^CSS \(TIANHE/, /^NOAA (19|20|21)$/, /^METOP-[ABC]$/, /^FENGYUN 3[DE]$/,
  /^GOES 1[689]$/, /^SUOMI ?1?0?0?$/, /^TERRA$/, /^AQUA$/, /^LANDSAT [89]$/, /^JASON-3$/,
  /^BEIDOU-3/, /^GLONASS/, /^IRIDIUM 1\d\d$/, /^ONEWEB-\d+$/, /^STARLINK-\d+$/, /^COSMOS 25\d\d$/,
  /^SENTINEL-\d/, /^METEOSAT/, /^INTELSAT/, /^TDRS/, /^SES-\d+$/, /^GALILEO/, /^GPS /,
  /^JWST$/, /^HST$/, /^TESS$/, /^CHANDRA$/, /^FERMI$/, /^GAIA \d*$/, /^SWOT$/, /^DSCVR$/,
];
for (const re of WANTED) {
  const hit = satnogsRows.find((r) => re.test((r.tle0 || "").replace(/^0 /, "")));
  if (hit) {
    add(hit.norad_cat_id, hit.tle0.replace(/^0 /, ""), hit.tle1, hit.tle2, "satnogs");
  }
}

/* --- 2) Complementos en Ivan (con backoff por los 508) --- */
const IVAN_SEARCHES = [
  "ISS", "TIANHE", "HST", "TESS", "JWST", "GPS BIII", "GALILEO 5", "GLONASS-M",
  "NOAA 21", "GOES 19", "METEOSAT-11", "SENTINEL-6", "TDRS-13", "STARLINK-1",
];
for (const q of IVAN_SEARCHES) {
  try {
    const j = await fetchJson(`https://tle.ivanstanojevic.me/api/tle/?search=${encodeURIComponent(q)}`, { tries: 3, backoffMs: 2000 });
    for (const m of j.member || []) {
      if (add(m.satelliteId, m.name, m.line1, m.line2, "ivan")) break; // 1 por búsqueda
    }
    await sleep(700); // cortesía con el límite de recursos de Ivan
  } catch (e) {
    console.log(`  Ivan search '${q}' omitido: ${e.message}`);
  }
}

/* --- 3) Equilibrar grupos: mínimo 3 por grupo usando SatNOGS --- */
const byGroup = {};
for (const p of picks) {
  const g = groupOf(p.name);
  byGroup[g] = (byGroup[g] || 0) + 1;
}
for (const g of GROUPS) {
  let guard = 0;
  while ((byGroup[g] || 0) < 3 && guard < 400) {
    guard++;
    const hit = satnogsRows.find((r) => {
      const name = (r.tle0 || "").replace(/^0 /, "");
      return groupOf(name) === g && !seenIds.has(r.norad_cat_id);
    });
    if (!hit) break;
    const name = hit.tle0.replace(/^0 /, "");
    if (add(hit.norad_cat_id, name, hit.tle1, hit.tle2, "satnogs")) byGroup[g] = (byGroup[g] || 0) + 1;
    else seenIds.add(hit.norad_cat_id); // no reintentar el mismo
  }
}

/* --- 4) Escribir seed-data.json --- */
const sats = picks.map((p) => ({
  id: p.id,
  name: p.name,
  line1: p.line1,
  line2: p.line2,
  group: groupOf(p.name),
  source: p.source,
}));
sats.sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || a.name.localeCompare(b.name));

const data = {
  generatedAt: now.toISOString(),
  provenance: "TLEs reales descargados de db.satnogs.org y tle.ivanstanojevic.me, validados (estructura + época no futura) con las funciones del proyecto.",
  sats,
};
writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");

const counts = {};
for (const s of sats) counts[s.group] = (counts[s.group] || 0) + 1;
console.log(`\nseed-data.json escrito: ${sats.length} satélites`);
console.log("Por grupo:", JSON.stringify(counts));
console.log("Por fuente:", JSON.stringify(sats.reduce((acc, s) => ((acc[s.source] = (acc[s.source] || 0) + 1), acc), {})));

await closeVite();
