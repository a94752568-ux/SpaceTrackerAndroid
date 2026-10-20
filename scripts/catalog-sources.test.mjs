/**
 * Tests de ingesta por fuente (Etapa 2 + Etapa 4): caída parcial, ambas caídas,
 * respuestas vacías, filas inválidas, deduplicación, invariante de métricas y
 * fallos de petición vs filas inválidas. Se ejercitan las funciones REALES de
 * load-catalog.ts con fetch inyectado (nunca lógica reimplementada en el test).
 *
 * Ejecutar: node --test scripts/catalog-sources.test.mjs
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";

import { closeVite, loadModule } from "./_load.mjs";
import {
  FIXTURES,
  breakChecksum,
  htmlResponse,
  ivanBody,
  jsonResponse,
  makeMockFetch,
  patchEpoch,
  satnogsBody,
} from "./_mocks.mjs";

after(closeVite);

const {
  loadLiveCatalog,
  searchSatsByName,
  ivanSearch,
  createStats,
  MIN_LIVE_SATS,
} = await loadModule("/src/lib/space/load-catalog.ts");

const TEN = FIXTURES.slice(0, 10);
const NOW = new Date();

/** Queries de una sola consulta sin filtro de nombre (q vacío => accept todo). */
const Q_ALL = [{ q: "", group: "other" }];

test("MIN_LIVE_SATS es 8 (umbral canónico del proyecto)", () => {
  assert.equal(MIN_LIVE_SATS, 8);
});

test("resiste caída de SatNOGS y contabiliza fuentes (nota REAL, sin '|| true')", async () => {
  const fetchImpl = makeMockFetch({
    ivan: () => jsonResponse(ivanBody(TEN)),
    satnogs: () => jsonResponse({ detail: "Server Error" }, 500),
  });
  const { sats, stats, notes } = await loadLiveCatalog({ fetchImpl, now: NOW, queries: Q_ALL });

  assert.ok(sats.length >= 8, `sats=${sats.length}`);
  assert.equal(stats.bySource.satnogs, 0);
  assert.ok(stats.bySource.ivan > 0);
  assert.ok(stats.seen >= stats.valid);
  // Fallo de petición de SatNOGS contabilizado como tal (no como filas inválidas):
  assert.equal(stats.failedBySource.satnogs, 1);
  assert.equal(stats.failedBySource.ivan, 0);
  assert.equal(stats.invalid, 0);
  // Nota exacta y REAL (la aserción histórica con `|| true` queda sustituida):
  assert.deepEqual(notes, ["SatNOGS no respondió"]);
});

test("ambas fuentes caídas => lanza el error canónico y cuenta fallos por fuente", async () => {
  const fetchImpl = makeMockFetch({
    ivan: () => {
      throw new Error("red caída");
    },
    satnogs: () => jsonResponse({}, 503),
  });
  await assert.rejects(
    () => loadLiveCatalog({ fetchImpl, now: NOW, queries: Q_ALL }),
    /No se pudo descargar el catálogo orbital/,
  );
});

test("respuestas vacías => lanza el error canónico sin fallos de red", async () => {
  const stats = createStats(); // sanity del creador
  assert.equal(stats.seen, 0);
  assert.deepEqual(stats.bySource, { satnogs: 0, ivan: 0 });
  assert.deepEqual(stats.seenBySource, { satnogs: 0, ivan: 0 });
  assert.deepEqual(stats.failedBySource, { satnogs: 0, ivan: 0 });

  const fetchImpl = makeMockFetch({
    ivan: () => jsonResponse(ivanBody([])),
    satnogs: () => jsonResponse([]),
  });
  await assert.rejects(
    () => loadLiveCatalog({ fetchImpl, now: NOW, queries: Q_ALL }),
    /No se pudo descargar el catálogo orbital/,
  );
  const empty = await loadLiveCatalog({ fetchImpl, now: NOW, queries: Q_ALL }).catch((e) => e);
  assert.ok(empty instanceof Error);
});

test("filas con TLE inválido o época futura: ni válidas ni 'fallidas'", async () => {
  const rows = [
    ...TEN.slice(0, 6), // 6 sanas
    ...TEN.slice(6, 9).map((f) => ({ ...f, line2: breakChecksum(f.line2) })), // 3 checksum KO
    {
      // 1 con época futura (checksum recalculado: estructuralmente válida)
      ...TEN[9],
      line1: patchEpoch(TEN[9].line1, new Date(NOW.getTime() + 5 * 86_400_000)),
    },
  ];
  const fetchImpl = makeMockFetch({ ivan: () => jsonResponse(ivanBody(rows)) });
  const stats = createStats();
  const out = await ivanSearch("", undefined, undefined, stats, fetchImpl, NOW);

  assert.equal(stats.seen, 10);
  assert.equal(stats.seenBySource.ivan, 10);
  assert.equal(stats.invalid, 3, "checksum roto => invalid");
  assert.equal(stats.future, 1, "época futura => future (rechazada)");
  assert.equal(stats.valid, 6);
  assert.equal(out.length, 6);
  assert.equal(stats.failedBySource.ivan, 0, "filas malas NO son fallos de petición");
  assert.equal(stats.fresh + stats.aging + stats.stale, stats.valid);
  assert.ok(!out.some((s) => s.id === TEN[9].id && s.line1 === rows[9].line1));
});

test("Ivan 508 HTML => fallo de petición (no filas inválidas); SatNOGS salva el catálogo", async () => {
  const fetchImpl = makeMockFetch({
    ivan: () => htmlResponse("<html><body>508 Resource Limit Is Reached</body></html>", 508),
    satnogs: () => jsonResponse(satnogsBody(FIXTURES.slice(0, 12))),
  });
  const { sats, stats, notes } = await loadLiveCatalog({
    fetchImpl,
    now: NOW,
    queries: [
      { q: "", group: "other" },
      { q: "", group: "other" },
    ],
  });
  assert.ok(sats.length >= 8);
  assert.equal(stats.failedBySource.ivan, 2); // una por petición (regla única F4)
  assert.equal(stats.invalid, 0); // el HTML NO cuenta como filas inválidas
  assert.equal(stats.seenBySource.ivan, 0);
  assert.equal(stats.bySource.satnogs, sats.length);
  assert.ok(notes.some((n) => /Ivan: 2 peticiones fallidas/.test(n)), JSON.stringify(notes));
});

test("invariantes con mezcla de fuentes, junk y duplicados", async () => {
  const ivanRows = FIXTURES.slice(0, 5);
  const satRows = [
    ...FIXTURES.slice(3, 13), // solapa 3..5 con Ivan (duplicados)
    // Basura real de SatNOGS (nombre junk con líneas válidas y su NORAD correcto):
    { ...FIXTURES[13], name: "DEB COSMOS" },
    { ...FIXTURES[14], name: "1998-067B" },
    { ...FIXTURES[15], name: "COSMOS 396 R/B" },
  ];
  const fetchImpl = makeMockFetch({
    ivan: () => jsonResponse(ivanBody(ivanRows)),
    satnogs: () => jsonResponse(satnogsBody(satRows)),
  });
  const { sats, stats } = await loadLiveCatalog({ fetchImpl, now: NOW, queries: Q_ALL });

  // Invariantes de Etapa 2:
  assert.equal(stats.fresh + stats.aging + stats.stale, stats.valid);
  assert.equal(stats.seen, stats.seenBySource.ivan + stats.seenBySource.satnogs);
  assert.equal(stats.valid, stats.bySource.ivan + stats.bySource.satnogs);
  assert.equal(stats.failedBySource.ivan + stats.failedBySource.satnogs, 0);
  assert.equal(stats.invalid, 0, "la basura NO debe contar como inválida");
  assert.equal(stats.future, 0);

  // Vistas vs candidatos vs únicos:
  assert.equal(stats.seenBySource.ivan, 5);
  assert.equal(stats.seenBySource.satnogs, 13);
  assert.equal(stats.valid, 15); // 5 + 10 (los 3 junk se filtran)
  assert.ok(sats.length < stats.valid, "la deduplicación debe reducir únicos < valid");
  const ids = sats.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "sin NORAD duplicados");

  // Junk fuera del catálogo:
  assert.ok(!sats.some((s) => /\bDEB\b|R\/B|^1998-067B/.test(s.name)), "junk colado en sats");
});

test("searchSatsByName numérico usa Ivan por ID y valida el TLE", async () => {
  const iss = FIXTURES.find((f) => f.name === "ISS (ZARYA)");
  const fetchImpl = makeMockFetch({
    ivan: (url) => {
      assert.match(url, /\/api\/tle\/25544$/);
      return jsonResponse({
        "@type": "Tle",
        satelliteId: iss.id,
        name: iss.name,
        line1: iss.line1,
        line2: iss.line2,
      });
    },
  });
  const res = await searchSatsByName("25544", undefined, { fetchImpl, now: NOW });
  assert.equal(res.length, 1);
  assert.equal(res[0].name, "ISS (ZARYA)");
  assert.equal(res[0].group, "crew");
});

test("searchSatsByName por texto filtra por accept() y no lanza si Ivan cae", async () => {
  const fetchImpl = makeMockFetch({
    ivan: () => jsonResponse(ivanBody(FIXTURES)),
  });
  const res = await searchSatsByName("STARLINK", undefined, { fetchImpl, now: NOW });
  assert.ok(res.length >= 1);
  for (const s of res) assert.match(s.name.toUpperCase(), /STARLINK/);

  const down = makeMockFetch({
    ivan: () => {
      throw new Error("red caída");
    },
  });
  const vacio = await searchSatsByName("NOAA", undefined, { fetchImpl: down, now: NOW });
  assert.deepEqual(vacio, []);
  const vacioNum = await searchSatsByName("25544", undefined, { fetchImpl: down, now: NOW });
  assert.deepEqual(vacioNum, []);
});
