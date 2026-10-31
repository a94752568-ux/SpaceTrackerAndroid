/**
 * Mapa Leaflet de SpaceTracker — RENDERIZADO HÍBRIDO por tiers:
 *
 *  TIER 1 (DOM, 1 nodo): satélite seleccionado → divIcon con icono SVG de su
 *    categoría, retícula HUD giratoria (.st-reticle), anillos de pulso
 *    (.selected-satellite-active) y rotación por rumbo orbital (--rot).
 *  TIER 2 (DOM interactivo, ≤ MAX_DOM_MARKERS): favoritos y categoría activa
 *    → divIcon con icono SVG detallado (badge ★ si es favorito), hover y click.
 *  TIER 3 (canvas, el resto de la flota): circleMarker sobre el renderer
 *    `L.canvas({ tolerance: 12 })` del mapa: un solo canvas, cero nodos DOM.
 *
 * Las posiciones de TODOS los tiers llegan del Web Worker SGP4 en cubos de
 * FLEET_UPDATE_MS (2 s) como Float64Array transferible; aplicar un frame es un
 * setLatLng por marcador existente (sin crear/destruir capas).
 *
 * Verificación CSS (req. 3): los iconos y el pulso viven en el marker-pane de
 * Leaflet (z-index 600), por encima del canvas pane (200); ninguna regla
 * global los oculta — cubierto por scripts/map-css.test.mjs.
 */
import { useEffect, useRef, useState } from "react";
import L from "leaflet";

import { bearingDeg, footprint, getFix, groundTrack, orbitParams, terminatorPolygon } from "../../lib/space/propagate";
import { getMoonPosition } from "../../lib/space/moon-position";
import type { Fix } from "../../lib/space/types";
import { FLEET_STRIDE, FLEET_UPDATE_MS } from "../../lib/space/fleet-compute";
import { FleetClient, type FleetFrame } from "../../lib/space/fleet-worker-client";
import type { Observer, Sat } from "../../lib/space/types";
import { GROUP_COLORS } from "../../lib/ui/colors";
import { escapeHtml, groupIconSvg, satIconHtml, SELECTED_SAT_CLASS, tacticalIconHtml } from "../../lib/ui/markers";
import { BASE_LAYERS, OVERLAYS } from "../../lib/ui/tiles";
import { fetchElevation } from "../../lib/ui/elevation";

interface MapViewProps {
  sats: Sat[];
  selected: Sat | null;
  tracked: boolean;
  observer: Observer | null;
  now: Date;
  /** Ids que pasan al tier DOM (favoritos + categoría activa, con tope). */
  domIds: Set<number>;
  /** Favoritos: llevan badge ★ en su puntero táctico. */
  favIds: Set<number>;
  /** Capa base activa ("esri-dark" | "esri-sat"): la gestiona el dock. */
  baseId: string;
  /** Overlays conmutables desde el menú CAPAS del dock. */
  overlays: { labels: boolean; terminator: boolean };
  /** Si no es null, el Radar Personalizado está activo con N favoritos. */
  radarCount?: number | null;
  /** Telemetría del motor de flota para los chips de estado del dock. */
  onFleetInfo?: (info: { worker: boolean; frameMs: number }) => void;
  /** El usuario arrastró el mapa: App puede liberar el seguimiento. */
  onUserPan?: () => void;
  /** Callback para actualizar el observador al hacer clic en el mapa. */
  onSetObserver?: (lat: number, lon: number, elevationM?: number) => void;
  /** Trigger para centrar el mapa en el observador (incrementar para activar). */
  centerOnObserverTrigger?: number;
  onSelect: (sat: Sat) => void;
  isGlitching?: boolean;
}

/** Parte una polilínea lat/lon en segmentos que no cruzan el antimeridiano. */
function splitAntimeridian(pts: L.LatLngExpression[][]): L.LatLngExpression[][] {
  const out: L.LatLngExpression[][] = [];
  for (const line of pts) {
    let seg: [number, number][] = [];
    let prevLon: number | null = null;
    for (const p of line as [number, number][]) {
      const [lat, lon] = p;
      if (prevLon !== null && Math.abs(lon - prevLon) > 180) {
        if (seg.length > 1) out.push(seg);
        seg = [];
      }
      seg.push([lat, lon]);
      prevLon = lon;
    }
    if (seg.length > 1) out.push(seg);
  }
  return out;
}

/** Satélite seleccionado: icono de su categoría + clase de pulso canónica. */
function satIconFor(sat: Sat): L.DivIcon {
  return L.divIcon({
    className: `st-sat-icon ${SELECTED_SAT_CLASS}`,
    html: satIconHtml(sat.group, GROUP_COLORS[sat.group]),
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/**
 * Tier DOM: puntero táctico 24×24 — anillo radar-ping escalonado por NORAD,
 * icono SVG de categoría con glow, badge ★ de favorito y etiqueta
 * inteligente (visible con zoom ≥ 5 o en hover).
 */
function domIconFor(sat: Sat, fav: boolean): L.DivIcon {
  return L.divIcon({
    className: "st-dom-icon",
    html: tacticalIconHtml(sat.group, GROUP_COLORS[sat.group], {
      fav,
      ping: `${(sat.id % 7) * 0.4}s`,
      label: sat.name,
    }),
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

/** Aplica el rumbo orbital como variable CSS --rot (gira `.st-ico`). */
function setRot(el: HTMLElement | null, deg: number | null): void {
  if (el && deg !== null) el.style.setProperty("--rot", `${deg.toFixed(1)}deg`);
}

const obsIcon = L.divIcon({
  className: "st-obs-icon",
  html: '<div class="st-obs-dot"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const FLEET_ON = { opacity: 1, fillOpacity: 0.95 };
const FLEET_OFF = { opacity: 0, fillOpacity: 0 };

export default function MapView({
  sats,
  selected,
  tracked,
  observer,
  now,
  domIds,
  favIds,
  baseId,
  overlays,
  radarCount = null,
  onFleetInfo,
  onUserPan,
  onSetObserver,
  centerOnObserverTrigger,
  onSelect,
  isGlitching = false,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const fleetRef = useRef<FleetClient | null>(null);
  const baseGroupsRef = useRef<Record<string, L.LayerGroup>>({});
  const refLayerRef = useRef<L.TileLayer | null>(null);
  const svgRendererRef = useRef<L.SVG | null>(null);
  const trackOldRef = useRef<L.Polyline | null>(null);
  const trackMidRef = useRef<L.Polyline | null>(null);
  const trackFutRef = useRef<L.Polyline | null>(null);
  const footRingRef = useRef<L.Circle | null>(null);
  const pulseRef = useRef<L.Marker | null>(null);
  const trackSamplesRef = useRef<Fix[] | null>(null);
  const lastInfoRef = useRef(0);
  const onFleetInfoRef = useRef(onFleetInfo);
  onFleetInfoRef.current = onFleetInfo;
  const favIdsRef = useRef(favIds);
  favIdsRef.current = favIds;
  const centerTriggerRef = useRef(0);
  const [zoomHi, setZoomHi] = useState(false);
  /** Tier 3: circleMarker en canvas. */
  const canvasMarkersRef = useRef<Map<number, L.CircleMarker>>(new Map());
  /** Tier 2: divIcon DOM (favoritos + categoría activa). */
  const domMarkersRef = useRef<Map<number, L.Marker>>(new Map());
  const domElsRef = useRef<Map<number, HTMLElement>>(new Map());
  const termRef = useRef<L.Polygon | null>(null);
  const flyUntilRef = useRef(0);
  const lastPostRef = useRef(0);
  const trailTimerRef = useRef<number | undefined>(undefined);
  const onUserPanRef = useRef(onUserPan);
  onUserPanRef.current = onUserPan;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  /** Tooltip COMPARTIDO para hover (uno solo para todos los tiers). */
  const tipRef = useRef<L.Tooltip | null>(null);
  const footRef = useRef<L.Circle | null>(null);
  const satMarkerRef = useRef<L.Marker | null>(null);
  const satElRef = useRef<HTMLElement | null>(null);
  const obsMarkerRef = useRef<L.Marker | null>(null);
  const moonMarkerRef = useRef<L.Marker | null>(null);
  const selectedIdRef = useRef<number | null>(null);

  const satsRef = useRef(sats);
  satsRef.current = sats;
  const nowRef = useRef(now);
  nowRef.current = now;

  /* Tooltip compartido (nombre + NORAD + icono SVG de la categoría). */
  const showTip = (sat: Sat, ll: L.LatLng) => {
    const map = mapRef.current;
    if (!map) return;
    if (!tipRef.current) {
      tipRef.current = L.tooltip({
        direction: "top",
        offset: [0, -10],
        className: "st-tip",
        opacity: 1,
        interactive: false,
      });
    }
    tipRef.current.setLatLng(ll);
    tipRef.current.setContent(
      `<span class="st-tip-ico">${groupIconSvg(sat.group, GROUP_COLORS[sat.group])}</span>` +
        `<b>${escapeHtml(sat.name)}</b><span class="st-tip-norad">NORAD ${sat.id}</span>`,
    );
    if (!map.hasLayer(tipRef.current)) tipRef.current.addTo(map);
  };
  const hideTip = () => tipRef.current?.remove();
  const showTipRef = useRef(showTip);
  showTipRef.current = showTip;

  /* --- inicialización del mapa --- */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      // Renderizador CANVAS forzado para todo lo vectorial (tier 3 incluido).
      renderer: L.canvas({ tolerance: 12, padding: 0.5 }),
      preferCanvas: true,
      worldCopyJump: true,
      minZoom: 2,
      maxZoom: 10,
      zoomControl: true,
      attributionControl: true,
    }).setView([25, 0], 3);
    svgRendererRef.current = L.svg({ padding: 0.4 });
    map.on("zoomend", () => setZoomHi(map.getZoom() >= 5));
    // Las capas base y los overlays se CREAN aquí; añadir/retirar lo gobiernan
    // los efectos por props (el menú CAPAS del dock sustituye a
    // L.control.layers y a la antigua leyenda flotante).
    for (const spec of BASE_LAYERS) {
      const lg = L.layerGroup(
        spec.layers.map((l) =>
          L.tileLayer(l.url, {
            attribution: l.attribution,
            maxZoom: l.maxZoom,
            opacity: l.opacity ?? 1,
            className: l.className,
          }),
        ),
      );
      baseGroupsRef.current[spec.id] = lg;
      if (spec.id === baseId) {
        lg.addTo(map);
      }
    }
    const labels = OVERLAYS.find((o) => o.id === "esri-ref");
    if (labels) {
      refLayerRef.current = L.tileLayer(labels.layer.url, {
        attribution: labels.layer.attribution,
        maxZoom: labels.layer.maxZoom,
        opacity: labels.layer.opacity ?? 1,
        className: labels.layer.className,
      });
    }
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
    map.on("dragstart", () => onUserPanRef.current?.());
    
    // Evento de clic en el mapa para actualizar el observador
    map.on("click", async (e) => {
      if (onSetObserver) {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;
        const elevation = await fetchElevation(lat, lon);
        onSetObserver(lat, lon, elevation ?? undefined);
      }
    });
    
    mapRef.current = map;
    fleetRef.current = new FleetClient();
    let invRaf = 0;
    const invalidate = () => {
      cancelAnimationFrame(invRaf);
      invRaf = requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
      });
    };
    const ro = new ResizeObserver(invalidate);
    if (containerRef.current) ro.observe(containerRef.current);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", invalidate);
    window.addEventListener("orientationchange", invalidate);
    try {
      const zc = (map as unknown as { zoomControl?: { setPosition: (p: string) => void } }).zoomControl;
      if (zc && typeof window !== "undefined" && window.innerWidth < 600) {
        zc.setPosition("bottomright");
      }
    } catch {
      /* ignore */
    }
    return () => {
      cancelAnimationFrame(invRaf);
      ro.disconnect();
      vv?.removeEventListener("resize", invalidate);
      window.removeEventListener("orientationchange", invalidate);
      window.clearTimeout(trailTimerRef.current);
      fleetRef.current?.terminate();
      fleetRef.current = null;
      canvasMarkersRef.current.clear();
      domMarkersRef.current.clear();
      domElsRef.current.clear();
      trackOldRef.current = null;
      trackMidRef.current = null;
      trackFutRef.current = null;
      footRingRef.current = null;
      pulseRef.current = null;
      trackSamplesRef.current = null;
      svgRendererRef.current = null;
      map.remove();
      mapRef.current = null;
      termRef.current = null;
      tipRef.current = null;
      footRef.current = null;
      satMarkerRef.current = null;
      satElRef.current = null;
      obsMarkerRef.current = null;
    };
  }, []);

  /* --- conmutación de capa base y overlays (menú CAPAS del dock) --- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [id, group] of Object.entries(baseGroupsRef.current)) {
      if (id === baseId) {
        if (!map.hasLayer(group)) group.addTo(map);
      } else if (map.hasLayer(group)) {
        map.removeLayer(group);
      }
    }
  }, [baseId]);

  useEffect(() => {
    const map = mapRef.current;
    const labelsLayer = refLayerRef.current;
    const term = termRef.current;
    if (!map || !labelsLayer || !term) return;
    if (overlays.labels && !map.hasLayer(labelsLayer)) labelsLayer.addTo(map);
    if (!overlays.labels && map.hasLayer(labelsLayer)) map.removeLayer(labelsLayer);
    if (overlays.terminator && !map.hasLayer(term)) term.addTo(map);
    if (!overlays.terminator && map.hasLayer(term)) map.removeLayer(term);
  }, [overlays]);

  /* --- sincronización de tiers con la lista visible + domIds --- */
  useEffect(() => {
    const map = mapRef.current;
    const fleet = fleetRef.current;
    if (!map || !fleet) return;
    fleet.setCatalog(sats);
    const seen = new Set<number>();
    for (const s of sats) {
      seen.add(s.id);
      const wantDom = domIds.has(s.id) && s.id !== selectedIdRef.current;
      const hasDom = domMarkersRef.current.has(s.id);
      const hasCm = canvasMarkersRef.current.has(s.id);

      if (wantDom && !hasDom) {
        //_promoción a tier DOM (o creación directa)
        if (hasCm) {
          canvasMarkersRef.current.get(s.id)?.remove();
          canvasMarkersRef.current.delete(s.id);
        }
        const mk = L.marker([0, 0], { icon: domIconFor(s, favIdsRef.current.has(s.id)) });
        mk.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          const el = mk.getElement();
          if (el) {
            el.classList.add("st-tap-pulse");
            setTimeout(() => el.classList.remove("st-tap-pulse"), 600);
          }
          onSelectRef.current(s);
        });
        mk.on("mouseover", () => showTipRef.current(s, mk.getLatLng()));
        mk.on("mouseout", hideTip);
        mk.addTo(map);
        domMarkersRef.current.set(s.id, mk);
        const el = mk.getElement()?.querySelector<HTMLElement>(".st-ico");
        if (el) domElsRef.current.set(s.id, el);
      } else if (!wantDom && hasDom) {
        // degradación a canvas (o eliminación si ya no está en la lista)
        domMarkersRef.current.get(s.id)?.remove();
        domMarkersRef.current.delete(s.id);
        domElsRef.current.delete(s.id);
        if (!hasCm && seen.has(s.id)) {
          const cm = L.circleMarker([0, 0], {
            radius: 2.8,
            weight: 1.25,
            color: GROUP_COLORS[s.group],
            fillColor: GROUP_COLORS[s.group],
            ...FLEET_OFF,
          });
          cm.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            const el = cm.getElement ? cm.getElement() : null;
            if (el) {
              el.classList.add("st-tap-pulse");
              setTimeout(() => el.classList.remove("st-tap-pulse"), 600);
            }
            onSelectRef.current(s);
          });
          cm.on("mouseover", () => showTipRef.current(s, cm.getLatLng()));
          cm.on("mouseout", hideTip);
          cm.addTo(map);
          canvasMarkersRef.current.set(s.id, cm);
        }
      } else if (!wantDom && !hasCm) {
        const cm = L.circleMarker([0, 0], {
          radius: 2.8,
          weight: 1.25,
          color: GROUP_COLORS[s.group],
          fillColor: GROUP_COLORS[s.group],
          ...FLEET_OFF,
        });
        cm.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          const el = cm.getElement ? cm.getElement() : null;
          if (el) {
            el.classList.add("st-tap-pulse");
            setTimeout(() => el.classList.remove("st-tap-pulse"), 600);
          }
          onSelectRef.current(s);
        });
        cm.on("mouseover", () => showTipRef.current(s, cm.getLatLng()));
        cm.on("mouseout", hideTip);
        cm.addTo(map);
        canvasMarkersRef.current.set(s.id, cm);
      }
    }
    for (const [id, mk] of domMarkersRef.current) {
      if (!seen.has(id) || id === selectedIdRef.current) {
        mk.remove();
        domMarkersRef.current.delete(id);
        domElsRef.current.delete(id);
      }
    }
    for (const [id, cm] of canvasMarkersRef.current) {
      if (!seen.has(id)) {
        cm.remove();
        canvasMarkersRef.current.delete(id);
      }
    }
  }, [sats.length, domIds]);

  /* --- frames del worker: cubos de 2 s + post-limit durante scrub --- */
  const fleetBucket = Math.floor(now.getTime() / FLEET_UPDATE_MS);
  const applyFrame = (frame: FleetFrame) => {
    const { ids, data } = frame;
    const t0 = performance.now();
    const map = mapRef.current;
    if (!map) return;
    const zoom = map.getZoom();
    // En zoom lejano (< 8), solo actualizar marcadores visibles en viewport para mejorar rendimiento
    const bounds = zoom < 8 ? map.getBounds() : null;
    // Limitar número de marcadores a actualizar por frame para evitar bloqueos
    let updated = 0;
    const maxUpdatesPerFrame = zoom < 8 ? 200 : 500;
    
    for (let i = 0; i < ids.length; i++) {
      if (updated >= maxUpdatesPerFrame) break;
      
      const id = ids[i];
      const o = i * FLEET_STRIDE;
      const ok = data[o + 5] === 1;
      const lat = data[o];
      const lon = data[o + 1];
      
      // Skip if zoom is low and marker is outside viewport
      if (bounds && (lat < bounds.getSouth() || lat > bounds.getNorth() || lon < bounds.getWest() || lon > bounds.getEast())) {
        continue;
      }
      
      const dom = domMarkersRef.current.get(id);
      if (dom) {
        if (ok) dom.setLatLng([lat, lon]);
        updated++;
        continue; // el tier DOM nunca se oculta: si no propaga, se queda quieto
      }
      const cm = canvasMarkersRef.current.get(id);
      if (!cm) continue;
      if (ok) {
        cm.setLatLng([lat, lon]);
        if (cm.options.fillOpacity === 0) cm.setStyle(FLEET_ON);
      } else if (cm.options.fillOpacity !== 0) {
        cm.setStyle(FLEET_OFF);
      }
      updated++;
    }
    if (onFleetInfoRef.current && Date.now() - lastInfoRef.current > 1000) {
      lastInfoRef.current = Date.now();
      onFleetInfoRef.current({
        worker: fleetRef.current?.usingWorker ?? false,
        frameMs: Math.round((performance.now() - t0) * 10) / 10,
      });
    }
  };
  const applyRef = useRef(applyFrame);
  applyRef.current = applyFrame;

  useEffect(() => {
    const fleet = fleetRef.current;
    if (!fleet) return;
    const post = () => {
      lastPostRef.current = Date.now();
      void fleet.request(nowRef.current.getTime()).then((frame) => {
        if (frame) applyRef.current(frame);
      });
    };
    const since = Date.now() - lastPostRef.current;
    // Throttling muy agresivo: 2000ms para modo mapa con muchos satélites
    const throttleMs = 2000;
    if (since < throttleMs) {
      window.clearTimeout(trailTimerRef.current);
      trailTimerRef.current = window.setTimeout(post, throttleMs + 10);
    } else {
      post();
    }
    return () => window.clearTimeout(trailTimerRef.current);
  }, [sats.length, domIds, fleetBucket]);

  /* --- observador --- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!observer) {
      obsMarkerRef.current?.remove();
      obsMarkerRef.current = null;
      return;
    }
    const latlng: L.LatLngTuple = [observer.latitude, observer.longitude];
    if (!obsMarkerRef.current) {
      obsMarkerRef.current = L.marker(latlng, {
        icon: obsIcon,
        zIndexOffset: 800,
        draggable: true,
      })
        .addTo(map)
        .bindTooltip("Observador (arrastrable)", { direction: "top" });

      // Evento de arrastre del marcador
      obsMarkerRef.current.on("dragend", async (e) => {
        const marker = e.target as L.Marker;
        const newPos = marker.getLatLng();
        const lat = newPos.lat;
        const lon = newPos.lng;

        // Obtener elevación automáticamente
        const elevation = await fetchElevation(lat, lon);
        onSetObserver?.(lat, lon, elevation ?? undefined);
      });
    } else {
      obsMarkerRef.current.setLatLng(latlng);
    }
  }, [observer, onSetObserver]);

  /* --- centrado en observador --- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !observer || centerOnObserverTrigger === undefined) return;
    centerTriggerRef.current = centerOnObserverTrigger;
  }, [centerOnObserverTrigger, observer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !observer || centerTriggerRef.current === 0) return;
    map.flyTo([observer.latitude, observer.longitude], Math.max(map.getZoom(), 6), { duration: 1.0 });
    centerTriggerRef.current = 0;
  }, [centerTriggerRef.current, observer]);

  /* --- Luna --- */
  const moonBucket = Math.floor(now.getTime() / 60000); // Actualizar cada minuto, no cada frame
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const moon = getMoonPosition(now);
    const latlng: L.LatLngTuple = [moon.lat, moon.lon];
    if (!moonMarkerRef.current) {
      moonMarkerRef.current = L.marker(latlng, {
        icon: L.divIcon({
          className: "st-moon-marker-icon",
          html: '<div style="font-size:20px; line-height:20px; text-shadow: 0 0 8px rgba(226,232,240,0.9);">🌙</div>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        zIndexOffset: 900,
      });
      moonMarkerRef.current.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectRef.current({
          id: 999999,
          name: "Luna (Moon)",
          line1: "",
          line2: "",
          group: "science",
        });
      });
      moonMarkerRef.current.addTo(map);
    } else {
      moonMarkerRef.current.setLatLng(latlng);
    }
    moonMarkerRef.current.bindTooltip(
      `<b>Luna</b><br/>Distancia: ${moon.distanceKm.toFixed(0)} km<br/>Sub-lunar: ${moon.lat.toFixed(2)}°, ${moon.lon.toFixed(2)}°`,
      { direction: "top", offset: [0, -10], className: "st-tip" },
    );
  }, [moonBucket]);

  /* --- Efecto Glitch exclusivo para satélites --- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const overlayPane = map.getPane("overlayPane");
    if (overlayPane) {
      if (isGlitching) {
        overlayPane.classList.add("glitch-satellites");
        overlayPane.style.filter =
          "contrast(1.35) saturate(1.45) drop-shadow(3px 0 0 #FF2DAA) drop-shadow(-3px 0 0 #00F5FF)";
      } else {
        overlayPane.classList.remove("glitch-satellites");
        overlayPane.style.filter = "";
      }
    }
    const satEl = satMarkerRef.current?.getElement();
    if (satEl) {
      if (isGlitching) satEl.classList.add("glitch-satellites");
      else satEl.classList.remove("glitch-satellites");
    }
    // Solo iterar sobre marcadores DOM (canvas markers no tienen elementos DOM)
    for (const domMk of domMarkersRef.current.values()) {
      const el = domMk.getElement();
      if (el) {
        if (isGlitching) el.classList.add("glitch-satellites");
        else el.classList.remove("glitch-satellites");
      }
    }
  }, [isGlitching]);

  /* --- TIER 1: seleccionado (DOM + retícula + pulso + rotación) --- */
  const selectedId = selected?.id ?? null;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!selected) {
      satMarkerRef.current?.remove();
      satMarkerRef.current = null;
      satElRef.current = null;
      trackOldRef.current?.remove();
      trackOldRef.current = null;
      trackMidRef.current?.remove();
      trackMidRef.current = null;
      trackFutRef.current?.remove();
      trackFutRef.current = null;
      footRef.current?.remove();
      footRef.current = null;
      footRingRef.current?.remove();
      footRingRef.current = null;
      pulseRef.current?.remove();
      pulseRef.current = null;
      trackSamplesRef.current = null;
      selectedIdRef.current = null;
      return;
    }
    const isNewSelection = selectedIdRef.current !== selected.id;
    selectedIdRef.current = selected.id;

    const fix = getFix(selected, now);
    if (!fix) {
      satMarkerRef.current?.remove();
      satMarkerRef.current = null;
      satElRef.current = null;
      return;
    }

    // Deferir trabajo pesado de creación de capas para mejorar INP
    const createLayers = () => {
      if (!satMarkerRef.current || isNewSelection) {
        satMarkerRef.current?.remove();
        satMarkerRef.current = L.marker([fix.latDeg, fix.lonDeg], {
          icon: satIconFor(selected),
          zIndexOffset: 1000,
        }).addTo(map);
        satElRef.current =
        satMarkerRef.current.getElement()?.querySelector<HTMLElement>(".st-ico") ?? null;
    } else {
      satMarkerRef.current.setLatLng([fix.latDeg, fix.lonDeg]);
    }
    const nextFix = getFix(selected, new Date(now.getTime() + 1000));
    setRot(satElRef.current, nextFix ? bearingDeg(fix, nextFix) : null);
    satMarkerRef.current.bindTooltip(`${selected.name} — ${fix.altKm.toFixed(0)} km`, {
      direction: "top",
      offset: [0, -10],
    });

    const periodMs = orbitParams(selected).periodMin * 60000;
    const back = groundTrack(selected, new Date(now.getTime() - periodMs), {
      orbits: 1,
      samples: 90,
    });
    const fwd = groundTrack(selected, now, { orbits: 1, samples: 90 });
    trackSamplesRef.current = fwd; // el pulso lumínico recorre el tramo futuro
    const half = Math.floor(back.length / 2);
    const segOld = splitAntimeridian([back.slice(0, half).map((f) => [f.latDeg, f.lonDeg] as [number, number])]);
    const segMid = splitAntimeridian([back.slice(half).map((f) => [f.latDeg, f.lonDeg] as [number, number])]);
    const segFut = splitAntimeridian([fwd.map((f) => [f.latDeg, f.lonDeg] as [number, number])]);
    const trackOpts = {
      color: "#00f5ff",
      weight: 1.8,
      interactive: false,
      bubblingMouseEvents: false,
      lineCap: "round" as const,
      lineJoin: "round" as const,
    } as L.PolylineOptions;
    // Órbita estilizada: fade hacia el pasado + dash animado en el futuro.
    if (!trackOldRef.current) {
      trackOldRef.current = L.polyline(segOld, { ...trackOpts, opacity: 0.14, className: "st-track-old" }).addTo(map);
      trackMidRef.current = L.polyline(segMid, { ...trackOpts, opacity: 0.32, className: "st-track-mid" }).addTo(map);
      trackFutRef.current = L.polyline(segFut, { ...trackOpts, opacity: 0.7, weight: 2.2, dashArray: "10 8", className: "st-track-fut" }).addTo(map);
    } else {
      trackOldRef.current.setLatLngs(segOld);
      trackMidRef.current?.setLatLngs(segMid);
      trackFutRef.current?.setLatLngs(segFut);
    }

    // Huella de visibilidad: COBERTURA PURA en renderer SVG con gradiente
    // radial y anillo punteado rotatorio. Sin interactive:false este círculo
    // (~2.200 km de radio) interceptaba todos los clics dentro del radio.
    const fp = footprint(selected, now);
    if (fp) {
      const svg = svgRendererRef.current;
      if (!footRef.current) {
        footRef.current = L.circle([fix.latDeg, fix.lonDeg], {
          radius: fp.radiusKm * 1000,
          className: "st-footprint",
          renderer: svg ?? undefined,
          stroke: true,
          color: "rgba(34, 211, 238, 0.5)",
          weight: 1,
          interactive: false,
          bubblingMouseEvents: false,
        }).addTo(map);
        footRingRef.current = L.circle([fix.latDeg, fix.lonDeg], {
          radius: fp.radiusKm * 1000 * 0.985,
          className: "st-foot-ring",
          renderer: svg ?? undefined,
          fill: false,
          color: "rgba(34, 211, 238, 0.65)",
          weight: 1.2,
          interactive: false,
          bubblingMouseEvents: false,
        }).addTo(map);
        // Gradiente radial inyectado una sola vez en el <svg> del renderer.
        const pathEl = footRef.current.getElement() as SVGElement | undefined;
        const svgEl = pathEl?.ownerSVGElement;
        if (svgEl && !svgEl.querySelector("#stFootGrad")) {
          svgEl.insertAdjacentHTML(
            "afterbegin",
            '<defs><radialGradient id="stFootGrad">' +
              '<stop offset="0%" stop-color="rgba(34,211,238,0.30)"/>' +
              '<stop offset="62%" stop-color="rgba(34,211,238,0.10)"/>' +
              '<stop offset="100%" stop-color="rgba(34,211,238,0)"/>' +
              "</radialGradient></defs>",
          );
        }
      } else {
        footRef.current.setLatLng([fix.latDeg, fix.lonDeg]);
        footRef.current.setRadius(fp.radiusKm * 1000);
        footRingRef.current?.setLatLng([fix.latDeg, fix.lonDeg]);
        footRingRef.current?.setRadius(fp.radiusKm * 1000 * 0.985);
      }
    }

    if (isNewSelection) {
      map.flyTo([fix.latDeg, fix.lonDeg], Math.max(map.getZoom(), 4), { duration: 1.6, easeLinearity: 0.35 });
      flyUntilRef.current = Date.now() + 1400;
    } else if (tracked && Date.now() > flyUntilRef.current) {
      map.panTo([fix.latDeg, fix.lonDeg], { animate: true, duration: 1.15, easeLinearity: 0.45 });
    }
    };

    // Deferir trabajo pesado usando requestIdleCallback para mejorar INP
    if (isNewSelection) {
      // Para selecciones nuevas, hacer el trabajo inmediatamente pero en microtask
      requestAnimationFrame(() => createLayers());
    } else {
      // Para actualizaciones, deferir usando requestIdleCallback
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => createLayers());
      } else {
        setTimeout(() => createLayers(), 0);
      }
    }
  }, [selected, now, tracked, selectedId]);

  /* Pulso lumínico recorriendo la órbita futura (rAF, un solo nodo DOM). */
  const selectedIdKey = selected?.id ?? null;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedIdKey === null) return;
    if (!pulseRef.current) {
      pulseRef.current = L.marker([0, 0], {
        icon: L.divIcon({
          className: "st-trackpulse-icon",
          html: '<span class="st-trackpulse"></span>',
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        }),
        interactive: false,
        zIndexOffset: 500,
      }).addTo(map);
    }
    const pulse = pulseRef.current;
    const t0 = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      const samples = trackSamplesRef.current;
      if (samples && samples.length > 1) {
        const span = 6000; // el pulso recorre la órbita futura cada 6 s
        const elapsed = Math.max(0, t - t0);
        const p = (elapsed % span) / span;
        const maxIdx = samples.length - 1;
        const idx = Math.max(0, Math.min(maxIdx, p * maxIdx));
        const i0 = Math.floor(idx);
        const i1 = Math.min(maxIdx, i0 + 1);
        const f = idx - i0;
        const s0 = samples[i0];
        const s1 = samples[i1];
        if (s0 && s1) {
          pulse.setLatLng([
            s0.latDeg + (s1.latDeg - s0.latDeg) * f,
            s0.lonDeg + (s1.lonDeg - s0.lonDeg) * f,
          ]);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [selectedIdKey]);

  /* Terminador solar: 1 recálculo por minuto. */
  const coarseMinute = Math.floor(now.getTime() / 60000);
  useEffect(() => {
    const ring = terminatorPolygon(now).map((p) => [p.latDeg, p.lonDeg] as L.LatLngTuple);
    termRef.current?.setLatLngs(ring);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coarseMinute]);

  return (
    <div className={zoomHi ? "st-map-wrap st-zoom-hi" : "st-map-wrap st-zoom-lo"}>
      <div ref={containerRef} className="st-map" />
      {radarCount !== null && (
        <div className="st-radar-chip" title="Radar Personalizado activo">
          📡 Radar personal · {radarCount} favorito{radarCount === 1 ? "" : "s"} en el mapa
        </div>
      )}
    </div>
  );
}
