# Tarea 4 — Globo y mapa adaptativos

**Estado:** ✅ Aplicada (commit `2e3e358`, 2026-10-26) y auditada en código el 2026-10-27 — 17/17 criterios verificados contra la rama. Pendiente únicamente verificación visual en emulador (ver `VERIFICACION.md`).  
**Rama:** `ui/responsive-movil`  
**Fecha:** 2026-10-26

## Objetivo

Canvas del globo ortográfico y mapa Leaflet se dimensionan por su contenedor y DPR, sin depender de `window.innerWidth`.

## Cambios

### GlobeView

| Aspecto | Comportamiento |
|---|---|
| Contenedor | `ResizeObserver` sobre `.st-globe-wrap` |
| DPR | `min(2, devicePixelRatio)` |
| Buffer | `canvas.width/height = layout × dpr`; CSS en px de layout |
| Fit | `fit = max(40, min(w,h) × 0.40)` → globo completo centrado (factor real en `globeFit.ts`; el contrato vigente es `globe-fit.test.mjs`: «usa el lado menor y factor 0.4») |
| Resize | Conserva zoom relativo y orientación (lat/lon) |
| Throttle | `requestAnimationFrame` |
| Zoom | Rueda + pellizco (2 punteros); ~0.55×–3.5× fit |
| Táctil | `touch-action: none` (CSS); drag 1 dedo rota |

### MapView

| Aspecto | Comportamiento |
|---|---|
| `invalidateSize` | ResizeObserver + `visualViewport.resize` + `orientationchange` |
| Throttle | rAF |
| Zoom control | `bottomright` si ancho < 600 |

## Cómo aplicar

```bash
git pull origin ui/responsive-movil
node scripts/apply-task4-map.mjs
npm run typecheck
node --test scripts/ortho.test.mjs
git add src/components/map/GlobeView.tsx src/components/map/MapView.tsx
git commit -m "fix(map): globo y mapa adaptativos al contenedor (Tarea 4)"
git push
```

## Criterio de aceptación

- Resize por contenedor + DPR acotado
- Globo completo centrado en pantallas estrechas sin deformar
- Orientación preservada al rotar
- Drag X/Y intacto (`ortho.test.mjs`)
- Leaflet `invalidateSize` en resize/orientación

## Auditoría de cumplimiento (2026-10-27)

Verificación estática contra la rama `ui/responsive-movil` (post commits de reparación de tests):

| Criterio | Evidencia en código | ✔ |
|---|---|---|
| ResizeObserver sobre `.st-globe-wrap` | `new ResizeObserver(scheduleResize)`; `ro.observe(wrap)` | ✅ |
| DPR acotado | `dpr = Math.min(2, window.devicePixelRatio || 1)` | ✅ |
| Buffer layout × dpr | `canvas.width = Math.round(w*dpr)` + `setTransform(dpr,0,0,dpr,0,0)` | ✅ |
| Fit por lado menor | `fitScale = Math.max(40, Math.min(cw,ch) * 0.40)` | ✅ |
| Zoom 0.55×–3.5× fit | `Math.max(fit*0.55, Math.min(fit*3.5, next))` (rueda y pellizco) | ✅ |
| Resize conserva zoom relativo | `userZoom = scale/prevFit` recalculado en `resize()` | ✅ |
| Throttle rAF | `scheduleResize` con `cancelAnimationFrame`+`requestAnimationFrame` | ✅ |
| Pellizco 2 punteros | `pointers` Map + `pinchStartDist/pinchStartScale` | ✅ |
| Rueda zoom | listener `wheel` con `preventDefault` | ✅ |
| Táctil sin scroll fantasma | `.st-globe { touch-action: none }` en `styles.css` | ✅ |
| MapView invalidateSize | ResizeObserver + `visualViewport.resize` + `orientationchange` → `map.invalidateSize({animate:false})` | ✅ |
| Zoom control bottomright < 600 px | `zc.setPosition("bottomright")` condicionado | ✅ |
| Tests del contrato | `globe-fit.test.mjs` (fit 0.4, clampDpr 2, buffer, resize, matrices) + `ortho.test.mjs` — en suite verde | ✅ |

Nota: el factor de fit real es **0.40 con piso de 40 px** (no 0.42 como decía el diseño inicial); `globeFit.ts` y `globe-fit.test.mjs` son la fuente de verdad y la suite pasa con ellos.
Pendiente solo lo que no se puede verificar por código: comportamiento táctil en emulador/dispositivo (rotar, pellizcar, girar el dispositivo) y capturas en `docs/responsive/despues/`.
