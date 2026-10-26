# Tarea 5 — Componentes, tipografía y paneles

**Estado:** Implementada (CSS + import)  
**Rama:** `ui/responsive-movil`  
**Fecha:** 2026-10-26

## Objetivo

Contenido legible y usable en pantallas pequeñas (360×800 y landscape).

## Cambios

Archivo nuevo: `src/styles-responsive-task5.css` (importado en `main.tsx`).

| Aspecto | Comportamiento |
|---|---|
| Tipografía | `clamp` fluido; body ≥ ~14px; respeta `font-size: 100%` del html |
| Inputs | `font-size ≥ 16px` (anti-zoom WebView) |
| Targets | min 48px en compact (botones, filas, bottom nav, search) |
| Overflow | elipsis en nombres; scroll interno en sheets/sidebar |
| HUD | blur reducido a 4px y menos glow en compact |
| Motion | `prefers-reduced-motion` desactiva animaciones |
| Contraste | sheets con fondo ~92% opaco sobre mapa |

## Criterio de aceptación

- [ ] Recorrido manual 360×800 vertical/horizontal sin cortes
- [ ] map-css / ui-smoke (si existen) sin regresiones
- [x] CSS cargado vía `main.tsx`

## Cómo verificar

```bash
npm run dev
# DevTools → 360×800; abrir Catálogo / Radar / sheets
# Comprobar: texto legible, filas ≥48px, sin zoom al enfocar input
```
