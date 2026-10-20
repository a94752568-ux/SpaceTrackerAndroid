/**
 * Tests de Etapa 3: procedencia (live/seed), fallback, merge/deduplicación,
 * compleción de grupos con seed y caché del servidor de catálogo.
 * Todo contra las funciones REALES de catalog.server.ts / seed.ts.
 *
 * Ejecutar: node --test scripts/catalog-fallback.test.mjs
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";

import { closeVite, loadModule } from "./_load.mjs";
import {
  FIXTURES,
  ivanBody,
  jsonResponse,
  makeMockFetch,
  satnogsBody,
} from "./_mocks.mjs";

after(closeVite);

const {
  loadCatalogOnce,
  getCatalog,
  invalidateCatalogCache,
  completeWithSeed,
  mergeCatalogs,
  SEED_SATS,
  SEED_FETCHED_AT,
  SEED_STATS,
} = await loadModule("/src/lib/space/catalog.server.ts");
const { validateTle } = await loadModule("/src/lib/space/tle-validation.ts");
const { GROUPS } = await loadModule("/src/lib/space/groups.ts");

const NOW = new Date();
const Q_ALL = [{ q: "", group: "other" }];

const healthyFetch = () =>
  makeMockFetch({
    ivan: () => jsonResponse(ivanBody(FIXTURES.slice(0, 10))),
    satnogs: () => jsonResponse(satnogsBody(FIXTURES.slice(5, 15))),
  });

const deadFetch = () =>
  makeMockFetch({
    ivan: () => jsonResponse({ detail: "no" }, 500),
    satnogs: () => jsonResponse({ detail: "no" }, 500),
  });

test("sanidad del seed: TLEs válidos, grupos cubiertos, ids únicos", () => {
  assert.ok(SEED_SATS.length >= 21, `seed=${SEED_SATS.length}`);
  const ids = new Set();
  for (const s of SEED_SATS) {
    assert.equal(validateTle(s.id, s.line1, s.line2).valid, true, `TLE inválido en seed: ${s.name}`);
    assert.ok(!ids.has(s.id), `id duplicado en seed: ${s.id}`);
    ids.add(s.id);
    assert.ok(GROUPS.includes(s.group), `grupo desconocido: ${s.group}`);
  }
  const counts = {};
  for (const s of SEED_SATS) counts[s.group] = (counts[s.group] || 0) + 1;
  for (const g of GROUPS) assert.ok((counts[g] || 0) >= 1, `grupo sin cobertura en seed: ${g}`);
  assert.ok(!Number.isNaN(Date.parse(SEED_FETCHED_AT)));
});

test("stats del seed coherentes (objetivo 4 de Etapa 2)", () => {
  assert.equal(SEED_STATS.seen, SEED_SATS.length);
  assert.equal(SEED_STATS.valid, SEED_SATS.length);
  assert.equal(SEED_STATS.fresh + SEED_STATS.aging + SEED_STATS.stale, SEED_STATS.valid);
  assert.equal(SEED_STATS.bySource.ivan + SEED_STATS.bySource.satnogs, SEED_STATS.valid);
  assert.equal(SEED_STATS.seenBySource.ivan + SEED_STATS.seenBySource.satnogs, SEED_STATS.seen);
  assert.deepEqual(SEED_STATS.failedBySource, { satnogs: 0, ivan: 0 });
  assert.equal(SEED_STATS.future, 0);
  assert.equal(SEED_STATS.invalid, 0);
});

test("live OK => source 'live' con nota de procedencia y stats reales", async () => {
  const payload = await loadCatalogOnce({ fetchImpl: healthyFetch(), now: NOW, queries: Q_ALL });
  assert.equal(payload.source, "live");
  assert.match(payload.note, /^live: \d+ satélites únicos \(Ivan \d+, SatNOGS \d+; vistos \d+, expirados \d+, decaídos \d+\)/);
  assert.equal(payload.stats.bySource.ivan, 10);
  assert.equal(payload.stats.bySource.satnogs, 10);
  // 15 únicos de las fuentes + 3 del seed (grupo starlink sin cobertura live)
  assert.equal(payload.sats.length, 18);
  const ids = payload.sats.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("live caído => fallback seed con procedencia clara y filtro estricto", async () => {
  const payload = await loadCatalogOnce({ fetchImpl: deadFetch(), now: NOW, queries: Q_ALL });
  assert.equal(payload.source, "seed");
  assert.equal(payload.fetchedAt, SEED_FETCHED_AT);
  assert.match(payload.note, /Catálogo local \(seed\)/);
  assert.match(payload.note, /No se pudo descargar el catálogo orbital/);
  assert.deepEqual(payload.sats.map((s) => s.id), SEED_SATS.map((s) => s.id));
  assert.equal(payload.stats.seen, SEED_STATS.seen);
});

test("mergeCatalogs: deduplica por NORAD y live gana", () => {
  const live = [{ id: 1, name: "LIVE-1", line1: "a", line2: "b", group: "other" }];
  const seed = [
    { id: 1, name: "SEED-1", line1: "x", line2: "y", group: "other" }, // duplicado
    { id: 2, name: "SEED-2", line1: "c", line2: "d", group: "nav" },   // nuevo
  ];
  const { sats, addedFromSeed } = mergeCatalogs(live, seed);
  assert.equal(sats.length, 2);
  assert.equal(addedFromSeed, 1);
  assert.equal(sats.find((s) => s.id === 1).name, "LIVE-1", "live debe ganar");
  assert.equal(sats.find((s) => s.id === 2).name, "SEED-2");
});

test("completeWithSeed: solo añade seed a grupos SIN cobertura live", () => {
  // Live con todos los grupos cubiertos => nada que añadir.
  const allGroups = GROUPS.map((g, i) => ({
    id: 900000 + i,
    name: `LIVE ${g}`,
    line1: "a",
    line2: "b",
    group: g,
  }));
  const full = completeWithSeed(allGroups, SEED_SATS);
  assert.equal(full.addedFromSeed, 0);
  assert.deepEqual(full.groupsTopped, []);

  // Live sin 'science' ni 'crew' => se completan esos grupos desde el seed.
  const partial = allGroups.filter((s) => s.group !== "science" && s.group !== "crew");
  const topped = completeWithSeed(partial, SEED_SATS, 4);
  assert.ok(topped.addedFromSeed > 0);
  assert.ok(topped.groupsTopped.includes("science"));
  assert.ok(topped.groupsTopped.includes("crew"));
  const added = topped.sats.slice(partial.length);
  for (const s of added) assert.ok(["science", "crew"].includes(s.group));
  const scienceAdded = added.filter((s) => s.group === "science").length;
  assert.ok(scienceAdded <= 4, `máximo por grupo respetado (${scienceAdded})`);
  // Sin duplicados de NORAD:
  const ids = topped.sats.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("getCatalog cachea (TTL) y invalidateCatalogCache fuerza recarga", async () => {
  invalidateCatalogCache();
  let calls = 0;
  const countingFetch = makeMockFetch({
    ivan: () => {
      calls++;
      return jsonResponse(ivanBody(FIXTURES.slice(0, 10)));
    },
    satnogs: () => jsonResponse(satnogsBody(FIXTURES.slice(5, 15))),
  });
  const opts = { fetchImpl: countingFetch, now: NOW, queries: Q_ALL };

  const p1 = await getCatalog(opts);
  const callsAfter1 = calls;
  const p2 = await getCatalog(opts);
  assert.equal(p2, p1, "la segunda llamada debe devolver el payload cacheado");
  assert.equal(calls, callsAfter1, "no debe haber peticiones adicionales con caché vigente");

  invalidateCatalogCache();
  const p3 = await getCatalog(opts);
  assert.ok(calls > callsAfter1, "tras invalidar debe volver a cargar");
  assert.equal(p3.source, "live");
  invalidateCatalogCache(); // dejar limpio para otras suites
});
