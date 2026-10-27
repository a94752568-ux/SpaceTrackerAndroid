# Tarea 5 — Componentes, tipografía y paneles

**Estado:** ✅ Implementada (CSS + import) y auditada en código el 2026-10-27 — 9/9 criterios verificados contra la rama. Pendiente únicamente el recorrido visual en emulador.  
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
- [x] map-css / ui-smoke (si existen) sin regresiones — suite completa verde el 2026-10-27 (24 suites, tras los commits de reparación de tests)
- [x] CSS cargado vía `main.tsx`

## Cómo verificar

```bash
npm run dev
# DevTools → 360×800; abrir Catálogo / Radar / sheets
# Comprobar: texto legible, filas ≥48px, sin zoom al enfocar input
```

## Auditoría de cumplimiento (2026-10-27)

Verificación estática contra 'src/styles-responsive-task5.css' (importado en 'main.tsx' tras styles.css y styles-responsive-task3.css):

| Criterio del diseño | Evidencia en el CSS | ✔ |
|---|---|---|
| Tipografía fluida | '--st-fs-body: clamp(0.875rem, 0.8rem + 0.35vw, 1rem)' (~14–16 px) + '--st-fs-ui', '--st-fs-label'; 'body { line-height: 1.45; text-size-adjust: 100% }' | ✅ |
| 'font-size: 100%' del html | 'html { font-size: 100% }' (respeta el zoom del SO) | ✅ |
| Inputs ≥ 16 px (anti-zoom WebView) | '.st-app input/textarea/select { font-size: max(16px, var(--st-fs-body)) }' + '.st-search input { font-size: 16px }' | ✅ |
| Targets ≥ 48 px en compact | '--st-touch-min: 48px' en botones, bottom-nav, tabs y filas (.st-list-row, .st-sat-row, .st-fav-row); medium con 44 px | ✅ |
| Overflow | elipsis (text-overflow: ellipsis) en nombres/filas/título; 'overflow-x: hidden; overflow-y: auto' con '-webkit-overflow-scrolling: touch' en sheets/sidebar | ✅ |
| HUD blur 4 px + menos glow | 'backdrop-filter: blur(4px)' y 'box-shadow: none' en header/sidebar/sheet/hud-panel; '.st-glow/.st-hyper-glow { filter: none }' | ✅ |
| 'prefers-reduced-motion' | media query: animaciones a 0.01 ms, glow y text-shadow desactivados | ✅ |
| Contraste | sheets/derecha con 'rgba(3, 5, 8, 0.92)' y texto '#f5f7fa' | ✅ |
| Sin regresiones de tests | map-css y ui-smoke dentro de la suite verde del 2026-10-27 | ✅ |

Nota de orden de carga: main.tsx importa styles.css → styles-responsive-task3.css → styles-responsive-task5.css → styles-immersion.css; la tarea 5 sobreescribe correctamente a las anteriores en compact.
Pendiente solo lo no verificable por código: recorrido manual 360×800 (texto legible, filas ≥ 48 px, sin zoom al enfocar un input) y capturas en 'docs/responsive/despues/'.
