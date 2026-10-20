/**
 * Tests de época TLE durante la ingesta (Etapa 1): rechazo de épocas futuras,
 * conservación de TLE antiguos con diagnóstico y contadores de distribución.
 * Se ejercita la ingesta REAL (ivanSearch/loadLiveCatalog) con fetch inyectado.
 *
 * Ejecutar: node --test scripts/live-catalog-epoch.test.mjs
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";

import { closeVite, loadModule } from "./_load.mjs";
import {
  FIXTURES,
  fixChecksum,
  ivanBody,
  jsonResponse,
  makeMockFetch,
  patchEpoch,
} from "./_mocks.mjs";

after(closeVite);

const { ivanSearch, loadLiveCatalog, createStats } = await loadModule(
  "/src/lib/space/load-catalog.ts",
);
const { hasValidTleEpoch, diagnoseTleEpoch } = await loadModule(
  "/src/lib/space/tle-epoch.ts",
);

const DAY = 86_400_000;
const NOW = new Date();
const BASE = FIXTURES[0];

/** Línea 1 con época desplazada `days` respecto a NOW (checksum corregido). */
function line1Aged(days, line1 = BASE.line1) {
  return patchEpoch(line1, new Date(NOW.getTime() - days * DAY));
}

test("la ingesta RECHAZA épocas futuras (contador future, fuera del catálogo)", async () => {
  // La época se parchea sobre la PROPIA línea del fixture (el id embebido debe
  // seguir coincidiendo, o validateTle lo rechazaría por otro motivo).
  const futureLine1 = line1Aged(-5, FIXTURES[8].line1); // 5 días en el futuro
  assert.equal(diagnoseTleEpoch(futureLine1, NOW).status, "future");
  const fetchImpl = makeMockFetch({
    ivan: () =>
      jsonResponse(
        ivanBody([
          ...FIXTURES.slice(0, 8),
          { ...FIXTURES[8], line1: futureLine1 },
        ]),
      ),
  });
  const stats = createStats();
  const out = await ivanSearch("", undefined, undefined, stats, fetchImpl, NOW);
  assert.equal(stats.future, 1);
  assert.equal(stats.valid, 8);
  assert.equal(out.length, 8);
  assert.ok(!out.some((s) => s.line1 === futureLine1));
});

test("la ingesta CONSERVA TLE antiguos dentro del umbral (stale ≤ 30 d)", async () => {
  // Base determinista: solo fixtures con época fresh AHORA (los datos reales
  // pueden traer algún TLE ya viejo, p. ej. STARLINK-2342 con ~70 días).
  const freshBase = FIXTURES.filter(
    (f) => diagnoseTleEpoch(f.line1, NOW).status === "fresh",
  ).slice(0, 8);
  assert.equal(freshBase.length, 8, "regenera scripts/fixtures.mjs: faltan TLEs frescos");
  const target = FIXTURES.find((f) => !freshBase.includes(f));
  // 20 días: stale pero DENTRO del umbral estricto de 30 d → se conserva.
  const staleLine1 = line1Aged(20, target.line1);
  assert.equal(diagnoseTleEpoch(staleLine1, NOW).status, "stale");
  assert.equal(hasValidTleEpoch(staleLine1, NOW), true);
  const fetchImpl = makeMockFetch({
    ivan: () =>
      jsonResponse(ivanBody([...freshBase, { ...target, line1: staleLine1 }])),
  });
  const stats = createStats();
  const out = await ivanSearch("", undefined, undefined, stats, fetchImpl, NOW);
  assert.equal(stats.stale, 1);
  assert.equal(stats.fresh, 8);
  assert.equal(stats.valid, 9);
  assert.ok(out.some((s) => s.line1 === staleLine1), "el TLE antiguo debe conservarse");
});

test("fresh/aging/stale se reparten según la edad en la ingesta", async () => {
  const rows = [
    { ...FIXTURES[0], line1: line1Aged(0, FIXTURES[0].line1) },   // fresh
    { ...FIXTURES[1], line1: line1Aged(1, FIXTURES[1].line1) },   // fresh
    { ...FIXTURES[2], line1: line1Aged(10, FIXTURES[2].line1) },  // aging
    { ...FIXTURES[3], line1: line1Aged(13, FIXTURES[3].line1) },  // aging
    { ...FIXTURES[4], line1: line1Aged(20, FIXTURES[4].line1) },  // stale (≤30 d)
    { ...FIXTURES[5], line1: line1Aged(28, FIXTURES[5].line1) },  // stale (≤30 d)
    { ...FIXTURES[6], line1: line1Aged(-2, FIXTURES[6].line1) },  // future => rechazada
    {
      // época ilegal (día 999) sobre la propia línea del fixture: id coherente,
      // checksum corregido => el único motivo de rechazo es la época.
      ...FIXTURES[7],
      line1: fixChecksum(
        FIXTURES[7].line1.slice(0, 18) + "26" + "999.50000000" + FIXTURES[7].line1.slice(32),
      ),
    },
  ];
  const fetchImpl = makeMockFetch({ ivan: () => jsonResponse(ivanBody(rows)) });
  const stats = createStats();
  const out = await ivanSearch("", undefined, undefined, stats, fetchImpl, NOW);

  assert.equal(stats.fresh, 2);
  assert.equal(stats.aging, 2);
  assert.equal(stats.stale, 2);
  assert.equal(stats.future, 1);
  assert.equal(stats.invalid, 1); // día 999 inexistente
  assert.equal(stats.valid, 6);
  assert.equal(out.length, 6);
  assert.equal(stats.fresh + stats.aging + stats.stale, stats.valid);
});

test("hasValidTleEpoch acepta fresh/aging/stale y rechaza future/invalid (función real)", () => {
  assert.equal(hasValidTleEpoch(line1Aged(0), NOW), true);
  assert.equal(hasValidTleEpoch(line1Aged(10), NOW), true);
  assert.equal(hasValidTleEpoch(line1Aged(100), NOW), true);
  assert.equal(hasValidTleEpoch(line1Aged(-1), NOW), false);
  const illegal = fixChecksum(BASE.line1.slice(0, 18) + "26" + "400.00000000" + BASE.line1.slice(32));
  assert.equal(hasValidTleEpoch(illegal, NOW), false);
});

test("loadLiveCatalog de extremo a extremo respeta la puerta de época", async () => {
  const fetchImpl = makeMockFetch({
    ivan: () =>
      jsonResponse(
        ivanBody([
          ...FIXTURES.slice(0, 9),
          { ...FIXTURES[9], line1: line1Aged(-3, FIXTURES[9].line1) }, // futura
        ]),
      ),
    satnogs: () => jsonResponse({ detail: "no" }, 500),
  });
  const { sats, stats } = await loadLiveCatalog({
    fetchImpl,
    now: NOW,
    queries: [{ q: "", group: "other" }],
  });
  assert.ok(sats.length >= 8);
  assert.equal(stats.future, 1);
  assert.equal(stats.fresh + stats.aging + stats.stale, stats.valid);
  assert.ok(!sats.some((s) => diagnoseTleEpoch(s.line1, NOW).status === "future"));
});
