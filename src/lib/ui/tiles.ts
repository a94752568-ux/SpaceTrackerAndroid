/**
 * Capas base del mapa: servidores de tiles GRATUITOS y de uso público SIN API key.
 *
 * Verificado el 2026-10-18 descargando e inspeccionando visualmente tiles reales
 * (z=5 sobre la península ibérica):
 * - CARTO (`basemaps.cartocdn.com`, dark_all / dark_nolabels) sirve hoy las tiles
 *   con marca de agua "API KEY REQUIRED" → DESCARTADO (era la causa reportada).
 * - Esri Canvas `World_Dark_Gray_Base` (+ `Reference` para rótulos): lienzo
 *   cartográfico oscuro limpio, sin marca de agua y sin clave.
 * - Esri `World_Imagery`: imagen satelital limpia sin clave; se atenúa con CSS
 *   (`st-tiles-dim`) para conservar la estética oscura del dashboard.
 *
 * Atribución exigida por Esri incluida en cada capa (se muestra en el control
 * de atribución de Leaflet). No añadir dominios que requieran clave
 * (stadia, thunderforest, maptiler…) sin revisar antes scripts/map-tiles.test.mjs.
 */

export interface TileLayerSpec {
  url: string;
  attribution: string;
  maxZoom: number;
  /** Opacidad 0–1 (la capa de rótulos va ligeramente translúcida). */
  opacity?: number;
  /** Clase CSS del pane de tiles (p. ej. atenuado del satelital). */
  className?: string;
}

export interface BaseLayerSpec {
  id: string;
  name: string;
  layers: TileLayerSpec[];
}

export const ATTRIB_ESRI_DARK =
  'Teselas: Esri, HERE, Garmin, &copy; OpenStreetMap contributors, y la comunidad de usuarios GIS';

export const ATTRIB_ESRI_IMAGERY =
  "Teselas: Esri, Maxar, Earthstar Geographics, y la Comunidad de Usuarios GIS";

/** Esri usa el orden /tile/{z}/{y}/{x} (Leaflet sustituye {z},{y},{x} en orden). */
const ESRI_TILE = (service: string) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`;

export const BASE_LAYERS: BaseLayerSpec[] = [
  {
    id: "esri-dark",
    name: "Oscuro (Esri Dark Gray)",
    layers: [
      {
        url: ESRI_TILE("Canvas/World_Dark_Gray_Base"),
        attribution: ATTRIB_ESRI_DARK,
        maxZoom: 16,
      },
    ],
  },
  {
    id: "esri-sat",
    name: "Satelital oscuro (Esri Imagery)",
    layers: [
      {
        // URL pública y gratuita de Esri, sin API key (verificada el 2026-10-18:
        // tile 200 sin marca de agua). Se atenúa con CSS para el tema oscuro.
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: ATTRIB_ESRI_IMAGERY,
        maxZoom: 17,
      },
    ],
  },
];

export const DEFAULT_BASE_ID = "esri-dark";

/**
 * Capas superpuestas conmutables desde el mismo control (checkbox):
 * los rótulos del canvas oscuro quedan bien también sobre la imagen
 * satelital, que no trae etiquetas propias.
 */
export interface OverlaySpec {
  id: string;
  name: string;
  layer: TileLayerSpec;
  defaultOn: boolean;
}

export const OVERLAYS: OverlaySpec[] = [
  {
    id: "esri-ref",
    name: "Rótulos (Esri Reference)",
    layer: {
      url: ESRI_TILE("Canvas/World_Dark_Gray_Reference"),
      attribution: ATTRIB_ESRI_DARK,
      maxZoom: 16,
      opacity: 0.9,
    },
    defaultOn: true,
  },
];
