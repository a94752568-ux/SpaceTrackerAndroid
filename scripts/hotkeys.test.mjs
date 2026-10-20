/**
 * Tests de los helpers puros de hotkeys de operador.
 * Ejecutar: node --test scripts/hotkeys.test.mjs
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";

import { closeVite, loadModule } from "./_load.mjs";

after(closeVite);

const { isTypingTarget, cycleFavorite } = await loadModule("/src/lib/ui/hotkeys.ts");

test("isTypingTarget: no pisa campos de texto", () => {
  assert.equal(isTypingTarget({ tagName: "INPUT" }), true);
  assert.equal(isTypingTarget({ tagName: "TEXTAREA" }), true);
  assert.equal(isTypingTarget({ tagName: "SELECT" }), true);
  assert.equal(isTypingTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isTypingTarget({ tagName: "DIV" }), false);
  assert.equal(isTypingTarget({ tagName: "BUTTON" }), false);
  assert.equal(isTypingTarget(null), false);
});

test("cycleFavorite: envoltura y entradas con selección ausente", () => {
  const ids = [10, 20, 30];
  assert.equal(cycleFavorite([], 5, 1), null);
  assert.equal(cycleFavorite(ids, null, 1), 10);
  assert.equal(cycleFavorite(ids, null, -1), 30);
  assert.equal(cycleFavorite(ids, 10, 1), 20);
  assert.equal(cycleFavorite(ids, 30, 1), 10, "envuelve hacia delante");
  assert.equal(cycleFavorite(ids, 10, -1), 30, "envuelve hacia atrás");
  assert.equal(cycleFavorite(ids, 999, 1), 10, "selección ajena a favoritos");
});
