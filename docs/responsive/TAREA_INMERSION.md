# Inmersión de producto — fases 1–3

## Fase 3 — HECHA

| Ítem | Implementación |
|---|---|
| Edad TLE visual | `tleAgeClass` → `st-tle-fresh/aging/stale` |
| Lock-on | `st-lock-on` 1.2 s al seleccionar |
| Interpolación | `interpolateFix` (lat/lon/alt, antimeridiano) |
| Beep catálogo | `playCatalogReadyBeep` al setPayload |
| Tests | `scripts/interpolateFix.test.mjs` |

```bash
git pull origin ui/responsive-movil
node scripts/apply-immersion-app.mjs
node scripts/apply-immersion-phase2.mjs
node scripts/apply-immersion-phase3.mjs
npm run typecheck && npm run build
node --test scripts/aosWatch.test.mjs scripts/interpolateFix.test.mjs
```
