# INFORME DE ESTADO PARA AGENTE DE IA (SESSION CONTEXT)
> **Actualizado:** 2026-10-26T22:45:00Z

## 1. Proyecto
* **Rama:** `ui/responsive-movil`
* **Repo:** https://github.com/a94752568-ux/SpaceTrackerAndroid
* **Stack:** Vite + React + TS · Capacitor 8 · targetSdk 36 · Tauri v2

## 2. Ruta responsive

| Tarea | Estado |
|---|---|
| 2–5 | Hechas en remoto |
| 4 Globo/mapa | Hecha (`fitScale`, `invRaf`) |
| 6 Android nativo | Hecha; App `st-android-back` → `node scripts/apply-task6-app.mjs` |
| 7 Matriz verificación | **Infra lista** — tests + `docs/responsive/VERIFICACION.md`; capturas UI pendientes en local |
| 8 Entrega | Pendiente |

## 3. Tarea 7 entregables
* `src/lib/ui/globeFit.ts` — fitScale, clampDpr, canvasBufferSize, MATRIX_VIEWPORTS
* `scripts/globe-fit.test.mjs` · `scripts/responsive-matrix.test.mjs`
* `docs/responsive/VERIFICACION.md` — tabla matriz + protocolo performance/release
* `docs/responsive/despues/README.md` — nombres de capturas
* `package.json` test incluye las dos suites nuevas

## 4. Acción local
```bash
git pull origin ui/responsive-movil
node scripts/apply-task6-app.mjs
npm run typecheck
node --test scripts/viewport.test.mjs scripts/globe-fit.test.mjs scripts/responsive-matrix.test.mjs
npm test
# Capturas → docs/responsive/despues/ y marcar ✅ en VERIFICACION.md
```

## 5. Próximo paso
Completar celdas manuales Tarea 7 → **Tarea 8** entrega (GUIA.md, commits, merge).

## 6. Restricciones
No tocar ~/SpaceTracker*; no plugins Capacitor sin permiso; no romper ortho/TLE.
