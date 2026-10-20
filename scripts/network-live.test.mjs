/**
 * Tests contra las FUENTES REALES (red). No forman de la suite por defecto:
 *   npm run test:live     (equivalente a RUN_LIVE=1 node --test scripts/network-live.test.mjs)
 *
 * Documentan el comportamiento observado de las APIs externas y ejercitan la
 * ingesta real de extremo a extremo. Si Ivan responde 508 por límite de
 * recursos, los reintentos con backoff deben absorberlo.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";

import { closeVite, loadModule } from "./_load.mjs";

const RUN_LIVE = process.env.RUN_LIVE === "1";

after(closeVite);

const { loadLiveCatalog, searchSatsByName, MIN_LIVE_SATS } = await loadModule(
  "/src/lib/space/load-catalog.ts",
);
const { loadCatalogOnce } = await loadModule("/src/lib/space/catalog.server.ts");

test(
  "loadLiveCatalog real: catálogo >= " + MIN_LIVE_SATS + " con invariantes",
  { skip: !RUN_LIVE && "ejecutar con RUN_LIVE=1" },
  async () => {
    const { sats, stats, notes } = await loadLiveCatalog({ budgetMs: 15000 });
    console.log("      live real:", sats.length, "únicos | seen", stats.seen, "| valid", stats.valid,
      "| fresh/aging/stale", stats.fresh, stats.aging, stats.stale,
      "| invalid", stats.invalid, "| future", stats.future,
      "| failed ivan/satnogs", stats.failedBySource.ivan, stats.failedBySource.satnogs,
      "| notas:", JSON.stringify(notes));
    assert.ok(sats.length >= MIN_LIVE_SATS);
    assert.equal(stats.fresh + stats.aging + stats.stale, stats.valid);
    assert.equal(stats.seen, stats.seenBySource.ivan + stats.seenBySource.satnogs);
    assert.equal(stats.valid, stats.bySource.ivan + stats.bySource.satnogs);
    assert.ok(sats.length <= stats.valid, "únicos <= candidatos aceptados");
    const ids = new Set(sats.map((s) => s.id));
    assert.equal(ids.size, sats.length);
  },
);

test(
  "loadCatalogOnce real devuelve payload con procedencia",
  { skip: !RUN_LIVE && "ejecutar con RUN_LIVE=1" },
  async () => {
    const payload = await loadCatalogOnce({ budgetMs: 15000 });
    console.log("      payload:", payload.source, "|", payload.sats.length, "sats |", payload.note);
    assert.ok(["live", "seed"].includes(payload.source));
    assert.ok(payload.sats.length >= MIN_LIVE_SATS);
    assert.ok(typeof payload.note === "string" && payload.note.length > 0);
    assert.ok(payload.stats);
  },
);

test(
  "searchSatsByName real: NORAD 25544 => ISS; texto NOAA => resultados",
  { skip: !RUN_LIVE && "ejecutar con RUN_LIVE=1" },
  async () => {
    const iss = await searchSatsByName("25544");
    assert.equal(iss.length, 1);
    assert.match(iss[0].name, /ISS/i);
    const noaa = await searchSatsByName("NOAA");
    assert.ok(noaa.length >= 1);
    for (const s of noaa) assert.match(s.name.toUpperCase(), /NOAA/);
  },
);
