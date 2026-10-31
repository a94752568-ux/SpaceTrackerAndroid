# Patch mapa visual

## Si MapView.tsx quedó corrupto (PLACEHOLDER)

```bash
git fetch origin
git show 137473308b97a68329b69b9e2c58f9e79337c1dd:src/components/map/MapView.tsx > src/components/map/MapView.tsx
```

## Cambios a aplicar en MapView.tsx

### 1. Terminador (más suave, sin tinte púrpura opaco)
```js
termRef.current = L.polygon([], {
  color: "#00f5ff",
  weight: 1.2,
  opacity: 0.55,
  dashArray: "5 6",
  fillColor: "#020814",
  fillOpacity: 0.22,
  interactive: false,
  bubblingMouseEvents: false,
  className: "st-terminator",
});
```

### 2. Filtro glitch (overlay pane)
```js
overlayPane.style.filter =
  "contrast(1.35) saturate(1.45) drop-shadow(3px 0 0 #FF2DAA) drop-shadow(-3px 0 0 #00F5FF)";
```

### 3. Dots de flota en canvas (mejor visibilidad)
`radius: 2.6`, `weight: 1.2` en ambos `L.circleMarker`.

## Ya en la rama (CSS)
`styles-neon-poster.css`: brightness mapa 0.82, glitch slice/scanlines, glows de satélites.
