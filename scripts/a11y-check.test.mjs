/**
 * Test suite de verificación automática de Accesibilidad (WCAG AA/AAA),
 * Design Tokens, Contraste de Color, Touch Targets y Rendimiento de Layout.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync("src/styles.css", "utf8");

/** Calcula luminancia relativa según especificación WCAG 2.1 */
function relativeLuminance(hex) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const R = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const G = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const B = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** Calcula relación de contraste entre dos colores HEX */
function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (brighter + 0.05) / (darker + 0.05);
}

test("Verificación de Design Tokens y Alias en CSS", () => {
  assert.match(css, /--bg-app:\s*var\(--bg\);/);
  assert.match(css, /--surface-panel:\s*var\(--bg-panel\);/);
  assert.match(css, /--text-muted:\s*var\(--muted\);/);
  assert.match(css, /--border-hud:\s*var\(--line\);/);
  assert.match(css, /--touch-target-min:\s*48px;/);
});

test("Matemáticas de Contraste WCAG para Tema Neon", () => {
  const bg = "#050505";
  const text = "#ffffff";
  const accent = "#00E5FF";
  const muted = "#a0a0c0";

  assert.ok(contrastRatio(text, bg) >= 7.0, "Texto principal en Neon cumple AAA (>= 7:1)");
  assert.ok(contrastRatio(accent, bg) >= 4.5, "Acento cian en Neon cumple AA/AAA (>= 4.5:1)");
  assert.ok(contrastRatio(muted, bg) >= 4.5, "Texto secundario en Neon cumple AA (>= 4.5:1)");
});

test("Matemáticas de Contraste WCAG para Tema Amber", () => {
  const bg = "#020604";
  const text = "#00FF66";
  const accent = "#FFB000";
  const muted = "#52c875";

  assert.ok(contrastRatio(text, bg) >= 7.0, "Texto principal en Amber cumple AAA (>= 7:1)");
  assert.ok(contrastRatio(accent, bg) >= 4.5, "Acento ámbar en Amber cumple AA/AAA (>= 4.5:1)");
  assert.ok(contrastRatio(muted, bg) >= 4.5, "Texto secundario en Amber cumple AA (>= 4.5:1)");
});

test("Accesibilidad de Movimiento y Estilizado de Scrollbars", () => {
  assert.match(css, /prefers-reduced-motion/, "Soporte obligatorio de prefers-reduced-motion");
  assert.match(css, /::-webkit-scrollbar/, "Estilizado de scrollbars presente");
});

test("Rendimiento de Layout en Bottom Sheets", () => {
  assert.match(css, /\.st-bottom-sheet\s*\{[\s\S]*?contain:\s*layout style paint;/, "Containment en bottom sheets");
  assert.match(css, /\.st-bottom-sheet\s*\{[\s\S]*?will-change:\s*transform;/, "Aceleración por hardware en bottom sheets");
});

test("Regla de no animar filter para glow", () => {
  const keyframeBlocks = css.match(/@keyframes[\s\S]*?\}/g) || [];
  for (const block of keyframeBlocks) {
    if (block.includes("glow")) {
      assert.ok(!block.includes("filter:"), "Las animaciones de glow no deben animar la propiedad CSS filter");
    }
  }
});
