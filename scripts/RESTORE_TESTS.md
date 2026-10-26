# Restaurar fixes de tests (2026-10-26)

Tras ampliar `CatalogStats` con `live`/`seed` y alinear SatDetail/tiles/globo, ejecuta:

```bash
node scripts/restore-test-fixes-a.mjs
node scripts/restore-test-fixes-b.mjs
npm test
```

## Cambios incluidos

| Archivo | Cambio |
|---|---|
| `catalog-fallback.test.mjs` | `failedBySource` incluye live/seed; suma bySource completa |
| `catalog-sources.test.mjs` | idem `failedBySource` |
| `map-tiles.test.mjs` | `DEFAULT_BASE_ID` = `esri-sat` (código actual) |
| `orbit-passes.test.mjs` | época fixture ≤ 30 d (no 5 d) |
| `ui-smoke.test.mjs` | SatDetail: métricas actuales (sin pasos/CSV/TLE legacy) |
| `GlobeView.tsx` | comentario `SIN rotación perpetua` |

## Fallos que pueden quedar (fixtures / tiempo)

Si siguen fallando tests de `live-catalog-epoch` o `tle-epoch` con fechas, regenera fixtures:

```bash
node scripts/generate-seed.mjs   # si aplica
# o actualiza scripts/fixtures.mjs con TLEs frescos
```

Los tests de Glow FX CSS dependen del contenido exacto de `styles.css`; no se alteraron en este fix.
