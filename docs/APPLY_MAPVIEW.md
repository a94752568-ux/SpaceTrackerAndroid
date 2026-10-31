# Aplicar cambios de MapView

`src/components/map/MapView.tsx` en remoto quedó en un estado inválido.
Restaura la versión buena y aplica el parche:

```bash
git fetch origin
git checkout ui/neon-poster
git pull

git show 137473308b97a68329b69b9e2c58f9e79337c1dd:src/components/map/MapView.tsx \
  | python3 scripts/patch_mapview.py \
  > src/components/map/MapView.tsx

npm run dev
```

## Cambios incluidos en el parche

1. **Terminador** — fill `#020814` opacity 0.22, stroke cyan, class `st-terminator`
2. **Glitch filter** — contrast + chromatic aberration (sin hue-rotate agresivo)
3. **Tracks** — color cyan, dash animado en órbita futura (`dashArray: "10 8"`)
4. **Dots flota** — radius 2.8, weight 1.25
5. **flyTo / panTo** — 1.6s / 1.15s con ease más suave
