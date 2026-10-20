# Código venderizado

| Módulo | Versión origen | Licencia | Uso |
|---|---|---|---|
| `d3-geo/src` | 3.1.1 | ISC | proyección ortográfica + path canvas |
| `topojson-client/src` | 3.1.0 | ISC | `feature()` para convertir TopoJSON |
| `world-atlas/land-110m.json` | 2.0.2 | dominio público (Natural Earth) | continentes 110 m |
| `d3-array-shim.js` | derivado de d3-array 3.2.4 | ISC | `range`, `merge`, `Adder` (lo único que usa d3-geo) |

Motivo: el entorno de despliegue del usuario dispone de un `node_modules`
externo antiguo; venderizar garantiza que el zip funcione sin reinstalar
nada. Los `import "d3-array"` de d3-geo se reescribieron a `../d3-array-shim.js`.
