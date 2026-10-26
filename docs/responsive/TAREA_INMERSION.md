# Inmersión de producto — fases 1 y 2

## Fase 2 — HECHA

| Ítem | Implementación |
|---|---|
| AOS/LOS | `aosWatch` + `lookAngles` cada 2s; beep + haptic + teleLog |
| Kp NOAA | `spaceWeather.fetchKpClass` → `data-kp` cada 15 min |
| ImmersionControls | En Dock (audio) |
| Haptic select | `handleSelect` |
| Elev mapa | Label el/az en observador (zoom ≥ 5) |

```bash
git pull origin ui/responsive-movil
node scripts/apply-immersion-app.mjs
node scripts/apply-immersion-phase2.mjs
npm run typecheck && npm run build
node --test scripts/aosWatch.test.mjs
```
