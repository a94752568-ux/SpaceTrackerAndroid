# Tarea 2 — Detección automática de pantalla (evidencia)

**Estado:** Completada  
**Rama:** `ui/responsive-movil`  
**Fecha:** 2026-10-26

## Objetivo

Un único módulo que clasifique el dispositivo y lo comunique al resto de la UI
(sin lógica de tamaños repartida por componentes).

## Entregables

| Entrega | Ubicación |
|---|---|
| Hook + API pura | `src/lib/ui/useViewport.ts` |
| Tests unitarios | `scripts/viewport.test.mjs` |
| Suite npm | `package.json` → script `test` incluye `viewport.test.mjs` |

## API pública

```ts
classifySize(width): SizeClass          // compact | medium | expanded
classifyOrientation(w, h): Orientation // portrait | landscape
readViewport(): ViewportState          // SSR-safe
applyViewportToDocument(state): void
useViewport(): ViewportState           // React hook
```

### ViewportState

- `width` / `height` — layout viewport en CSS px (≈ dp en WebView Android)
- `orientation` — `portrait` \| `landscape`
- `sizeClass` — MD3 window size classes:
  - **compact** — width ≤ 599
  - **medium** — 600–839
  - **expanded** — ≥ 840
- `dpr` — `devicePixelRatio`
- `isTouch` — `matchMedia('(pointer: coarse)')`
- `prefersReducedMotion` — `matchMedia('(prefers-reduced-motion: reduce)')`
- `visualViewportHeight` — alto del Visual Viewport (teclado / chrome)

### Publicación en DOM

Sobre `<html>`:

- `data-size="compact|medium|expanded"`
- `data-orientation="portrait|landscape"`
- `data-touch="true|false"`
- `--vw` / `--vh` (CSS custom properties en px)

## Decisiones técnicas

1. **Sin dividir por DPR en nativo.** Con `viewport-fit=cover` y meta correcta,
   `window.innerWidth` en Capacitor/WebView ya está en CSS px. La heurística
   anterior (`rawW / dpr`) podía clasificar mal tablets y emuladores.
2. **Listeners:** `resize`, `orientationchange`, `visualViewport.resize/scroll`,
   y `matchMedia(...).change`. Throttle con `requestAnimationFrame`. Cleanup al
   desmontar.
3. **Funciones puras exportadas** para tests sin montar React.
4. **App.tsx** ya consume `useViewport()` (`isCompact`); no requiere cambios
   de firma (campos nuevos son aditivos).

## Criterio de aceptación (plan)

- [x] Clasificación por ancho en límites 599/600 y 839/840 (tests).
- [x] Orientación cubierta por tests.
- [x] Atributos `data-size` / `data-orientation` (y `data-touch`) en `<html>`.
- [x] Variables CSS `--vw` / `--vh`.
- [x] `isTouch`, `prefersReducedMotion`, `visualViewportHeight`.
- [x] Sin polling; SSR-safe.
- [ ] Verificación manual en emulador con `adb shell wm size` (pendiente de
      matriz en Tarea 7; el hook reacciona a resize/orientationchange).

## Cómo verificar en local

```bash
npm run typecheck
node --test scripts/viewport.test.mjs
npm test   # suite completa, incluye viewport
```

En emulador / DevTools: cambiar el ancho y comprobar en la consola del WebView:

```js
document.documentElement.dataset.size
document.documentElement.dataset.orientation
getComputedStyle(document.documentElement).getPropertyValue('--vw')
```

## Siguiente paso

**Tarea 3** — plano de layout por `sizeClass` (Header, Sidebar, paneles) antes
de implementar la reorganización estructural.
