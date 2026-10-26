# Recuperación de archivos corruptos (SEE_FILE / stub)

Durante la subida automática de la Tarea 3/4, `src/App.tsx` y `src/styles.css` en la rama `ui/responsive-movil` quedaron sobrescritos con placeholders.

## Síntoma

- UI en **fondo blanco**, tipografía del sistema, sin HUD/mapa con tema oscuro.
- O solo el mensaje “restaurando App.tsx”.

## Arreglo (en la raíz del repo)

```bash
git pull origin ui/responsive-movil

# 1) CSS (imprescindible para el tema)
node scripts/restore-styles.mjs

# 2) App completa + parches Tarea 3
node scripts/restore-app-task3.mjs

# 3) Globo/mapa Tarea 4 (opcional si aún no)
node scripts/apply-task4-map.mjs

# 4) Reiniciar Vite
npm run dev
```

Luego confirma en el navegador (hard refresh Ctrl+Shift+R):
- Fondo oscuro `#030508` / tema Mission Control
- Mapa o globo visible
- Header con glassmorphism

```bash
npm run typecheck
git add src/App.tsx src/styles.css src/components/map/
git commit -m "fix(ui): restaurar App.tsx y styles.css + Tareas 3-4"
git push origin ui/responsive-movil
```
