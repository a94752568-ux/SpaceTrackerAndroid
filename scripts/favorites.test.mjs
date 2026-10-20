/**
 * Tests del módulo de favoritos v2 (listas personalizadas + radar).
 * Ops puras: sin DOM ni localStorage (en Node las funciones de persistencia
 * degradan a no-op de forma segura).
 *
 * Ejecutar: node --test scripts/favorites.test.mjs
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";

import { closeVite, loadModule } from "./_load.mjs";

after(closeVite);

const F = await loadModule("/src/lib/ui/favorites.ts");

test("emptyState: una lista por defecto y radar apagado", () => {
  const s = F.emptyState();
  assert.equal(s.lists.length, 1);
  assert.equal(s.lists[0].name, "Favoritos");
  assert.equal(s.radarMode, false);
  assert.equal(F.allFavoriteIds(s).size, 0);
});

test("migración v1: array plano => lista por defecto con esos ids", () => {
  const s = F.migrateFromV1([25544, 43435, 25544, -5, "basura"]);
  assert.equal(s.lists.length, 1);
  assert.deepEqual(s.lists[0].satIds, [25544, 43435], "deduplica y descarta inválidos");
  assert.equal(s.radarMode, false);
});

test("loadFavoritesState en Node (sin window) devuelve estado válido", () => {
  const s = F.loadFavoritesState();
  assert.ok(Array.isArray(s.lists) && s.lists.length >= 1);
  assert.equal(typeof s.radarMode, "boolean");
});

test("sanitizeState descarta localStorage corrupto y siempre da forma válida", () => {
  assert.equal(F.sanitizeState(null), null);
  assert.equal(F.sanitizeState("texto"), null);
  assert.equal(F.sanitizeState({ lists: "no" }), null);
  // Entradas individuales inválidas se descartan; el estado resultante sigue
  // siendo utilizable (lista por defecto repuesta, cero favoritos).
  const rotten = F.sanitizeState({ lists: [{ id: 1, name: 2, satIds: 3 }] });
  assert.ok(rotten);
  assert.equal(F.allFavoriteIds(rotten).size, 0);
  assert.equal(rotten.lists.length, 1);
  const ok = F.sanitizeState({
    lists: [{ id: "a", name: "Mía", icon: "★", satIds: [25544, "x"], createdAt: "2026-01-01" }],
    radarMode: true,
  });
  assert.ok(ok);
  assert.deepEqual(ok.lists[0].satIds, [25544], "filtra ids no enteros");
  assert.equal(ok.radarMode, true);
});

test("createList: nombres únicos con sufijo y lista nueva al final", () => {
  let s = F.emptyState();
  s = F.createList(s, "Constelaciones");
  s = F.createList(s, "Constelaciones");
  s = F.createList(s, "Constelaciones");
  const names = s.lists.map((l) => l.name);
  assert.deepEqual(names, ["Favoritos", "Constelaciones", "Constelaciones 2", "Constelaciones 3"]);
  // id único por lista
  assert.equal(new Set(s.lists.map((l) => l.id)).size, s.lists.length);
});

test("toggleSatInList: añade/quita y es INMUTABLE", () => {
  const s0 = F.emptyState();
  const id = s0.lists[0].id;
  const s1 = F.toggleSatInList(s0, id, 25544);
  assert.deepEqual(s1.lists[0].satIds, [25544]);
  assert.deepEqual(s0.lists[0].satIds, [], "el estado original no muta");
  assert.notEqual(s1, s0);
  const s2 = F.toggleSatInList(s1, id, 25544);
  assert.deepEqual(s2.lists[0].satIds, []);
  // togglear en otra lista no toca la primera
  const s3 = F.createList(s1, "Estaciones");
  const s4 = F.toggleSatInList(s3, s3.lists[1].id, 48274);
  assert.deepEqual(s4.lists[0].satIds, [25544]);
  assert.deepEqual(s4.lists[1].satIds, [48274]);
});

test("allFavoriteIds: unión sin duplicados entre listas", () => {
  let s = F.emptyState();
  const a = s.lists[0].id;
  s = F.createList(s, "Otra");
  const b = s.lists[1].id;
  s = F.toggleSatInList(s, a, 25544);
  s = F.toggleSatInList(s, b, 25544);
  s = F.toggleSatInList(s, b, 20580);
  assert.deepEqual([...F.allFavoriteIds(s)].sort(), [20580, 25544]);
  assert.deepEqual(F.listsContaining(s, 25544).sort(), [a, b].sort());
  assert.deepEqual(F.listsContaining(s, 20580), [b]);
});

test("renameList recorta espacios y rechaza vacíos", () => {
  let s = F.emptyState();
  const id = s.lists[0].id;
  s = F.renameList(s, id, "  Estaciones Espaciales  ");
  assert.equal(s.lists[0].name, "Estaciones Espaciales");
  const same = F.renameList(s, id, "   ");
  assert.equal(same.lists[0].name, "Estaciones Espaciales", "renombrar a vacío no cambia nada");
});

test("deleteList elimina y ensureDefaultList repone una lista", () => {
  let s = F.emptyState();
  const id = s.lists[0].id;
  s = F.toggleSatInList(s, id, 25544);
  s = F.deleteList(s, id);
  assert.equal(s.lists.length, 1, "borrar la única lista repone la por defecto");
  assert.equal(F.allFavoriteIds(s).size, 0, "los favoritos de la lista borrada desaparecen");
  const vacio = F.ensureDefaultList({ lists: [], radarMode: true });
  assert.equal(vacio.lists.length, 1);
  assert.equal(vacio.radarMode, true, "ensureDefaultList conserva el radar");
});

test("setRadarMode conmuta sin tocar las listas", () => {
  let s = F.emptyState();
  s = F.toggleSatInList(s, s.lists[0].id, 25544);
  const on = F.setRadarMode(s, true);
  assert.equal(on.radarMode, true);
  assert.deepEqual(on.lists, s.lists);
  assert.equal(F.setRadarMode(on, false).radarMode, false);
});
