# INFORME DE ESTADO PARA AGENTE DE IA (SESSION CONTEXT)
> **Actualizado:** 2026-10-26T22:30:00Z

## 1. Proyecto
* **Rama:** `ui/responsive-movil`
* **Repo:** https://github.com/a94752568-ux/SpaceTrackerAndroid
* **Stack:** Vite + React + TS · Capacitor 8 · targetSdk 36 · Tauri v2

## 2. Ruta responsive (PROMPT_AGENTE_RESPONSIVE_MOVIL.md)

| Tarea | Estado |
|---|---|
| 2 useViewport | Hecha |
| 3 Layout compact/sheets | Hecha en App.tsx |
| 4 Globo/mapa | Script listo → `node scripts/apply-task4-map.mjs` |
| 5 Tipografía/targets | Hecha (`styles-responsive-task5.css`) |
| 6 Android edge-to-edge | **Hecha (nativo + scripts)** |
| 7 Matriz dispositivos | Pendiente |
| 8 Entrega | Pendiente |

## 3. Acción local pendiente

```bash
git pull origin ui/responsive-movil
node scripts/apply-task4-map.mjs
node scripts/apply-task6-app.mjs
npm run typecheck
npm run build && npx cap sync android
```

Verificar emulador: barras, teclado, rotación, atrás cierra sheet.

## 4. Tarea 6 archivos
* `MainActivity.java` — edge-to-edge
* `styles.xml` / `colors.xml` — HUD #030508
* `AndroidManifest.xml` — adjustResize, resizeable, ambas orientaciones
* `src/lib/ui/androidChrome.ts` + `main.tsx`
* `scripts/apply-task6-app.mjs`
* `docs/responsive/TAREA6_ANDROID.md`

## 5. Orientación
Ambas por defecto (`unspecified`). Pedir confirmación para bloquear portrait.

## 6. Restricciones
No tocar ~/SpaceTracker*; no plugins Capacitor nuevos sin permiso; no romper drag X/Y ni filtro TLE.
