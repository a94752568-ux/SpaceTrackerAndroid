# Tarea 4 — Globo y mapa adaptativos

**Estado:** Lista para aplicar con `node scripts/apply-task4-map.mjs`  
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
| Fit | `scale_fit = min(w,h) × 0.42` → globo completo centrado, 1:1 |
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
