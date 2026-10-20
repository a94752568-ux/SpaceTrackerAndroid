/**
 * Tests de detección/guards de entorno nativo (parte pura, segura en Node).
 * Ejecutar: node --test scripts/native-guards.test.mjs
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { closeVite, loadModule } from "./_load.mjs";

after(closeVite);

const N = await loadModule("/src/lib/ui/native.ts");
const K = await loadModule("/src/lib/ui/useKioskMode.ts");

test("kioskSupported: false en Node/SSR (sin document)", () => {
  assert.equal(K.kioskSupported(), false);
});

test("isKioskKey: F11 global, F solo fuera de campos de texto", () => {
  const ev = (over) => ({ key: "", ctrlKey: false, metaKey: false, altKey: false, target: null, ...over });
  // F11: siempre (incluso con foco en input: es tecla de función)
  assert.equal(K.isKioskKey(ev({ key: "F11" })), true);
  assert.equal(K.isKioskKey(ev({ key: "F11", target: { tagName: "INPUT" } })), true);
  // Alias táctico F/f fuera de campos:
  assert.equal(K.isKioskKey(ev({ key: "f" })), true);
  assert.equal(K.isKioskKey(ev({ key: "F" })), true);
  // …pero NUNCA dentro de la búsqueda u otros campos:
  assert.equal(K.isKioskKey(ev({ key: "f", target: { tagName: "INPUT" } })), false);
  assert.equal(K.isKioskKey(ev({ key: "f", target: { tagName: "TEXTAREA" } })), false);
  assert.equal(K.isKioskKey(ev({ key: "f", target: { tagName: "SELECT" } })), false);
  assert.equal(K.isKioskKey(ev({ key: "f", target: { tagName: "DIV", isContentEditable: true } })), false);
  // Modificadores del sistema reservados:
  assert.equal(K.isKioskKey(ev({ key: "f", ctrlKey: true })), false);
  assert.equal(K.isKioskKey(ev({ key: "F11", metaKey: true })), false);
  // Otras teclas no conmutan:
  assert.equal(K.isKioskKey(ev({ key: "a" })), false);
  assert.equal(K.isKioskKey(ev({ key: "Escape" })), false);
});

test("en Node (SSR/tests) nada se detecta como nativo", () => {
  assert.equal(N.isTauri(), false);
  assert.equal(N.isCapacitor(), false);
  assert.equal(N.isNative(), false);
});

test("installNativeGuards es no-op seguro fuera de nativo y devuelve cleanup", () => {
  const cleanup = N.installNativeGuards();
  assert.equal(typeof cleanup, "function");
  assert.doesNotThrow(() => cleanup());
});

test("WindowControls NO importa el paquete API de Tauri (bundle web limpio)", () => {
  // Regresión del fallo de dev-server: Vite resuelve los imports dinámicos en
  // transform, así que el paquete nativo no puede aparecer en el source.
  const src = readFileSync("src/components/hud/WindowControls.tsx", "utf8");
  assert.ok(!src.includes("@tauri-apps/api"), "WindowControls debe usar el global __TAURI__");
  assert.match(src, /__TAURI__/, "usa el global inyectado (withGlobalTauri)");
});
