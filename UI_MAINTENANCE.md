# Guía de Mantenimiento y Protección de UI — SpaceTracker

Este documento establece las reglas obligatorias de mantenimiento a largo plazo para evitar regresiones visuales, de accesibilidad, de rendimiento o de compatibilidad WebView/Nativo en SpaceTracker.

---

## 1. Temas y Design Tokens
- **Temas Soportados**:
  - `Neon`: Cyberpunk Neon Synthwave (Cian / Rosa / Amarillo / Fondo `#050505`).
  - `Amber`: Cyberpunk Matrix Ops (Ámbar / Verde / Obsidiana `#020604`).
- **Uso de Tokens**:
  - **MANDATORIO**: Usar siempre variables CSS (`var(--accent)`, `var(--bg)`, `var(--muted)`).
  - **PROHIBIDO**: Hardcodear colores HEX/RGB fuera de la definición de tokens en `styles.css`.
  - **Alias de Compatibilidad**: Usar `--text-muted`, `--bg-app`, `--surface-panel` y `--border-hud`.

---

## 2. Renderizado del Globo 2D (Proyección Ortográfica)
- **Canvas 2D Puro**: Todo el renderizado es en un `<canvas>` 2D mediante `d3-geo`.
- **PROHIBIDO**: Usar WebGL, Three.js, shaders o postprocessing externo.
- **Animación de Respiración**: Se ejecuta dinámicamente en el render loop mediante `ctx.scale()` desde el centro `(cx, cy)`, sin alterar las dimensiones DOM del canvas ni su transform CSS.
- **Glow Sincronizado**: El brillo se calcula con `ctx.shadowBlur` y `ctx.shadowColor` en `globalCompositeOperation = "lighter"` en doble pasada sobre elementos luminosos.
- **Sin Animación de Filtro CSS**: No animar la propiedad CSS `filter` del canvas para evitar reflows de GPU.

---

## 3. Accesibilidad y Ergonomía Táctil
- **Contraste WCAG**:
  - Relación de contraste mínima de **4.5:1** (WCAG AA) para texto secundario (`--muted`) y **7:1** (WCAG AAA) para texto principal (`--text`).
  - Verificado matemáticamente en `scripts/a11y-check.test.mjs`.
- **Objetivos Táctiles**:
  - Dimensión mínima interactiva de **48×48 dp** (`--touch-target-min: 48px`).
- **Reduced Motion**:
  - Toda animación respeta `@media (prefers-reduced-motion: reduce)` desactivando movimientos continuos.
- **Scrollbars**:
  - Estilizados de forma coherente con el tema mediante `::-webkit-scrollbar`.

---

## 4. Feature Flags (Despliegue Seguro de UI)
Ubicación: `src/lib/ui/feature-flags.ts`
Flags disponibles para conmutación segura sin tocar lógica de negocio:
- `globeBreathing`: Activa la animación de respiración canvas.
- `strongerGlowPulse`: Activa el pulso de brillo en doble pasada.
- `newBottomSheetAnimation`: Controla las animaciones de entrada de hojas inferiores.
- `amberContrastFix`: Aplica la paleta de contraste elevado para el tema Amber.

---

## 5. Contrato de Comunicación WebView / Nativo
Ubicación: `src/lib/ui/bridge-contract.ts`
- `WEB_UI_VERSION = "1.2.0"`
- `MIN_NATIVE_BRIDGE_VERSION = "1.0.0"`
- Detección de capacidades (`geolocation`, `wakeLock`, `statusBar`, `splashScreen`) con degradación progresiva limpia en entornos web o emuladores sin plugins nativos.

---

## 6. Manifiesto e Integridad de Assets
Script: `node scripts/generate-manifest.mjs`
- Genera `dist/asset-manifest.json` con hashes SHA-256 de cada archivo en `dist/` para verificación de integridad y cache busting durante despliegues web o sincronía Capacitor.

---

## 7. Pipeline de Integración Continua (CI/CD)
Archivo: `.github/workflows/ci.yml`
Ejecuta automáticamente en cada Pull Request / Push:
1. `npm run typecheck`: Validación estricta de tipos TypeScript.
2. `npm test`: Suite completa de tests unitarios, visuales (`map-css`, `ui-smoke`) y accesibilidad (`a11y-check`).
3. `npm run build`: Compilación de producción.
4. `node scripts/generate-manifest.mjs`: Verificación de integridad de assets.

---

## 8. Estrategia de Release Protegida
1. **Incrustar Versión**: Incrementar `versionCode` y `versionName` en `app/build.gradle`.
2. **Verificación Automatizada**:
   - `npm run typecheck && npm test`
   - `npm run build && node scripts/generate-manifest.mjs`
3. **Internal Testing**: Despliegue en canal interno de Google Play Console.
4. **Closed Testing**: Pruebas con grupo controlado de usuarios.
5. **Staged Rollout**:
   - Día 1: 10% de los usuarios.
   - Día 3: 25% de los usuarios.
   - Día 5: 50% de los usuarios.
   - Día 7: 100% de los usuarios.
6. **Criterio de Rollback**: Si la tasa de ANRs o crasheos supera el **0.1%**, se pausa la versión y se revierte al build anterior.
