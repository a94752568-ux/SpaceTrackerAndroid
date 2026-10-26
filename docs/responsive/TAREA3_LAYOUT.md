# Tarea 3 — Estructura de interfaz por sizeClass

**Rama:** `ui/responsive-movil`  
**Fecha:** 2026-10-26

## Comportamiento

| sizeClass | Layout |
|---|---|
| **compact** (≤599) | Mapa full; bottom nav; un sheet a la vez; Dock oculto; Header compacto |
| **medium** (600–839) | Sidebar estrecha; Dock visible; sin bottom nav |
| **expanded** (≥840) | Desktop / kiosco sin cambios |

## Cambios App.tsx

1. `isMedium` + clases root `is-compact` / `is-medium`
2. Al salir de compact → `setCompactTab(null)`
3. Escape cierra sheet compact primero
4. Backdrop `.st-sheet-backdrop`
5. Landscape: sheet lateral (CSS)

## Recuperación si App.tsx quedó corrupto en remoto

```bash
git fetch origin
git checkout 2a4758f5391b30a722ac193dade79eef09e1452c -- src/App.tsx
patch -p0 < docs/responsive/tarea3-app.patch
# Importar CSS extra en main.tsx si no está:
# import "./styles-responsive-task3.css";
npm run typecheck && npm test
```

## Criterio de aceptación

- Compact: un panel a la vez + bottom nav + mapa base
- Escape / backdrop cierran sheet
- Cambio de sizeClass limpia sheets
- Expanded sin bottom nav / sheets
