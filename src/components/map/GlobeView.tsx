/**
 * GlobeView — globo terráqueo en PROYECCIÓN ORTOGRÁFICA 2D con respiración canvas y alto rendimiento.
 *
 * Garantía SIN rotación perpetua: el globo está ESTÁTICO por defecto; el giro
 * es explícito (botón «Girar») y el centrado solo ocurre con lock de seguimiento.
 *
 * PERF 2026-10-30: flota agrupada por color SIN shadowBlur por punto
 * (antes ~15k save/shadow/restore → FPS 1 en GLOBO).
 *
 * PROFUNDIDAD 2026-10-31 (canvas nativo, sin dependencias nuevas):
 * - Atmósfera volumétrica cian (limbo + halo) que respira con el globo.
 * - Luces de ciudad con bloom (vértices costeros, doble pasada) y nubes
 *   bajas con sombra proyectada, cacheadas en el offscreen.
 * - 3 anillos orbitales con inclinación/velocidad distintas (parallax):
 *   mitad trasera oculta tras el planeta, mitad frontal por delante.
 * - Observador con núcleo pulsante + onda expansiva doble; órbita del
 *   seleccionado con partículas fluyendo (dash animado) y estela cometa.
 */
import { useEffect, useRef, useState } from "react";
import { geoGraticule10, geoOrthographic, geoPath } from "../../vendor/d3-geo/index.js";
import { feature } from "../../vendor/topojson-client/index.js";
import landRaw from "../../vendor/land-110m.json?raw";

import { FLEET_STRIDE, FLEET_UPDATE_MS } from "../../lib/space/fleet-compute";
import { FleetClient, type FleetFrame } from "../../lib/space/fleet-worker-client";
import { dragToRotation, orthoProject, wrapLonDeg, type OrthoView } from "../../lib/space/ortho";
import { getFix, groundTrack } from "../../lib/space/propagate";
import { getMoonPosition } from "../../lib/space/moon-position";
import type { Fix, Observer, Sat } from "../../lib/space/types";
import { GROUP_COLORS } from "../../lib/ui/colors";

interface GlobeViewProps {
  sats: Sat[];
  selected: Sat | null;
  observer: Observer | null;
  now: Date;
  tracked: boolean;
  onSelect: (sat: Sat) => void;
  onUserPan?: () => void;
  centerOnObserverTrigger?: number;
  isGlitching?: boolean;
}

const topo = JSON.parse(landRaw) as unknown as { objects: { land: unknown } };
const LAND = feature(topo as never, topo.objects.land as never) as unknown as GeoJSON.GeoJsonObject;
const GRATICULE = geoGraticule10();

/* Luces de ciudad: vértices costeros deterministas del land-110m como proxy
   (las ciudades se agrupan en costas); 1 de cada 9, tope 900 puntos. */
const CITY_POINTS: [number, number][] = [];
{
  let n = 0;
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === "number" && typeof node[1] === "number") {
      if (n++ % 9 === 0 && CITY_POINTS.length < 900) {
        CITY_POINTS.push([node[0] as number, node[1] as number]);
      }
      return;
    }
    for (const child of node) walk(child);
  };
  walk(
    (LAND as unknown as { features: { geometry: { coordinates: unknown } }[] }).features.map(
      (f) => f.geometry.coordinates,
    ),
  );
}

/* Nubes bajas deterministas: celdas suaves repartidas en ángulo dorado. */
const CLOUDS: { lat: number; lon: number; r: number; a: number }[] = Array.from({ length: 16 }, (_, i) => ({
  lat: Math.asin(Math.sin(i * 2.39996)) * 57.29578 * 0.9,
  lon: ((i * 137.5077) % 360) - 180,
  r: 0.09 + (((i * 37) % 100) / 100) * 0.13,
  a: 0.5 + (((i * 53) % 100) / 100) * 0.5,
}));

/* Anillos orbitales decorativos: 3 capas con inclinación, tamaño y velocidad
   distintas para parallax; cada una lleva un punto que la recorre. */
const ORBIT_RINGS = [
  { tilt: -18, squash: 0.3, radius: 1.38, speed: 0.16, color: "#00f5ff" },
  { tilt: 24, squash: 0.24, radius: 1.62, speed: -0.1, color: "#a78bff" },
  { tilt: -52, squash: 0.36, radius: 1.88, speed: 0.06, color: "#5eead4" },
];

export default function GlobeView({
  sats,
  selected,
  observer,
  now,
  tracked,
  onSelect,
  onUserPan,
  centerOnObserverTrigger,
}: GlobeViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  const [autoRotate, setAutoRotate] = useState(false);
  const [speed, setSpeed] = useState(1.5);
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const viewRef = useRef<OrthoView>({ latDeg: 18, lonDeg: -30, scale: 0 });
  const fleetRef = useRef<FleetClient | null>(null);
  const frameRef = useRef<FleetFrame | null>(null);
  const satsRef = useRef(sats);
  satsRef.current = sats;
  const byIdRef = useRef<Map<number, Sat>>(new Map());
  const hitsRef = useRef<{ x: number; y: number; id: number }[]>([]);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const trackedRef = useRef(tracked);
  trackedRef.current = tracked;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onUserPanRef = useRef(onUserPan);
  onUserPanRef.current = onUserPan;
  const observerRef = useRef(observer);
  observerRef.current = observer;
  const nowRef = useRef(now);
  nowRef.current = now;
  const centerTriggerRef = useRef(0);
  const trackRef = useRef<{ key: string; pts: Fix[] } | null>(null);

  useEffect(() => {
    byIdRef.current = new Map(sats.map((s) => [s.id, s]));
    if (!fleetRef.current) fleetRef.current = new FleetClient();
    fleetRef.current.setCatalog(sats);
    frameRef.current = null;
  }, [sats]);

  useEffect(
    () => () => {
      fleetRef.current?.terminate();
      fleetRef.current = null;
      frameRef.current = null;
    },
    [],
  );

  const bucket = Math.floor(now.getTime() / FLEET_UPDATE_MS);
  useEffect(() => {
    const client = fleetRef.current;
    if (!client || sats.length === 0) return;
    let cancelled = false;
    client.request(now.getTime()).then((f) => {
      if (!cancelled && f) frameRef.current = f;
    });
    return () => {
      cancelled = true;
    };
  }, [bucket, sats]);

  useEffect(() => {
    if (centerOnObserverTrigger !== undefined) {
      centerTriggerRef.current = centerOnObserverTrigger;
    }
  }, [centerOnObserverTrigger]);

  useEffect(() => {
    if (centerTriggerRef.current === 0 || !observer) return;
    viewRef.current.latDeg = observer.latitude;
    viewRef.current.lonDeg = observer.longitude;
    centerTriggerRef.current = 0;
  }, [centerTriggerRef.current, observer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const off = document.createElement("canvas");
    const octx = off.getContext("2d");
    if (!octx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let cacheKey = "";
    let resizeRaf = 0;

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      w = r.width;
      h = r.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      off.width = canvas.width;
      off.height = canvas.height;
      if (viewRef.current.scale <= 0) {
        viewRef.current.scale = Math.min(w, h) * 0.42;
      }
      cacheKey = "";
    };

    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(resize);
    });
    ro.observe(wrap);
    resize();

    const drawEarth = () => {
      const v = viewRef.current;
      const cx = w / 2;
      const cy = h / 2 - 14;
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      octx.clearRect(0, 0, w, h);
      const projection = geoOrthographic()
        .scale(v.scale)
        .translate([cx, cy])
        .rotate([-v.lonDeg, -v.latDeg, 0]);
      const path = geoPath(projection, octx as unknown as CanvasRenderingContext2D);
      octx.beginPath();
      path({ type: "Sphere" });
      octx.fillStyle = "#020c14";
      octx.fill();
      octx.beginPath();
      path(GRATICULE as never);
      octx.strokeStyle = "rgba(0, 245, 255, 0.12)";
      octx.lineWidth = 0.6;
      octx.stroke();
      octx.beginPath();
      path(LAND as never);
      octx.fillStyle = "rgba(0, 80, 100, 0.55)";
      octx.fill();
      octx.strokeStyle = "rgba(0, 229, 255, 0.70)";
      octx.lineWidth = 1.4;
      octx.shadowColor = "rgba(0, 229, 255, 0.9)";
      octx.shadowBlur = 20;
      octx.stroke();
      octx.shadowBlur = 0;

      /* Luces de ciudad con bloom: dos pasadas (halo + núcleo), sin shadowBlur
         para no matar el FPS durante el arrastre. */
      const sinLat0 = Math.sin((v.latDeg * Math.PI) / 180);
      const cosLat0 = Math.cos((v.latDeg * Math.PI) / 180);
      const lonRad0 = (v.lonDeg * Math.PI) / 180;
      const cities: { x: number; y: number }[] = [];
      for (const [lon, lat] of CITY_POINTS) {
        const phi = (lat * Math.PI) / 180;
        const lam = (lon * Math.PI) / 180;
        const cosd = sinLat0 * Math.sin(phi) + cosLat0 * Math.cos(phi) * Math.cos(lam - lonRad0);
        if (cosd <= 0.04) continue;
        const ll: [number, number] = [lon, lat];
        const pt = projection(ll);
        if (!pt) continue;
        cities.push({ x: pt[0], y: pt[1] });
      }
      octx.beginPath();
      for (const c of cities) { octx.moveTo(c.x + 2.1, c.y); octx.arc(c.x, c.y, 2.1, 0, Math.PI * 2); }
      octx.fillStyle = "rgba(255, 214, 122, 0.14)";
      octx.fill();
      octx.beginPath();
      for (const c of cities) { octx.moveTo(c.x + 0.9, c.y); octx.arc(c.x, c.y, 0.9, 0, Math.PI * 2); }
      octx.fillStyle = "rgba(255, 224, 150, 0.85)";
      octx.fill();

      /* Nubes bajas con sombra proyectada: rotan con el globo (offscreen). */
      for (const cl of CLOUDS) {
        const phi = (cl.lat * Math.PI) / 180;
        const lam = (cl.lon * Math.PI) / 180;
        const cosd = sinLat0 * Math.sin(phi) + cosLat0 * Math.cos(phi) * Math.cos(lam - lonRad0);
        if (cosd <= 0.06) continue;
        const ll: [number, number] = [cl.lon, cl.lat];
        const pt = projection(ll);
        if (!pt) continue;
        const cr = v.scale * cl.r * (0.65 + cosd * 0.35);
        const px = pt[0];
        const py = pt[1];
        const sh = octx.createRadialGradient(px + cr * 0.18, py + cr * 0.24, 0, px + cr * 0.18, py + cr * 0.24, cr);
        sh.addColorStop(0, `rgba(0, 34, 52, ${(0.22 * cl.a * cosd).toFixed(3)})`);
        sh.addColorStop(1, "rgba(0, 34, 52, 0)");
        octx.fillStyle = sh;
        octx.beginPath();
        octx.arc(px + cr * 0.18, py + cr * 0.24, cr, 0, Math.PI * 2);
        octx.fill();
        const cg = octx.createRadialGradient(px, py, 0, px, py, cr);
        cg.addColorStop(0, `rgba(224, 246, 255, ${(0.3 * cl.a * cosd).toFixed(3)})`);
        cg.addColorStop(1, "rgba(224, 246, 255, 0)");
        octx.fillStyle = cg;
        octx.beginPath();
        octx.arc(px, py, cr, 0, Math.PI * 2);
        octx.fill();
      }
    };

    let raf = 0;
    let prevT = performance.now();
    const FRAME_INTERVAL = 1000 / 60;
    let lastFrameTime = 0;

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      const elapsed = t - lastFrameTime;
      if (elapsed < FRAME_INTERVAL) return;
      lastFrameTime = t - (elapsed % FRAME_INTERVAL);
      const dt = Math.min(100, t - prevT);
      prevT = t;
      const v = viewRef.current;
      const cx = w / 2;
      const cy = h / 2 - 14;
      const sel = selectedRef.current;

      if (autoRotateRef.current) {
        v.lonDeg = wrapLonDeg(v.lonDeg + speedRef.current * (dt / 1000));
      }
      if (trackedRef.current && sel) {
        const fix = getFix(sel, nowRef.current);
        if (fix) {
          const k = 1 - Math.exp(-dt / 250);
          const dLon = ((fix.lonDeg - v.lonDeg + 540) % 360) - 180;
          const dLat = fix.latDeg - v.latDeg;
          if (Math.abs(dLon) > 0.01 || Math.abs(dLat) > 0.01) {
            v.lonDeg = wrapLonDeg(v.lonDeg + dLon * k);
            v.latDeg = Math.max(-90, Math.min(90, v.latDeg + dLat * k));
          }
        }
      }

      const key = `${(Math.round(v.lonDeg * 2) / 2).toFixed(1)}|${(Math.round(v.latDeg * 2) / 2).toFixed(1)}|${Math.round(v.scale)}`;
      if (key !== cacheKey) {
        cacheKey = key;
        drawEarth();
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const time = performance.now() / 1000;
      const period = 3.4;
      const amplitude = reducedMotion ? 0 : 0.018;
      const breath = reducedMotion ? 0.5 : (Math.sin((time * Math.PI * 2) / period) + 1) / 2;
      const scale = 1 + (breath - 0.5) * 2 * amplitude;

      /* Anillos orbitales: mitad trasera ANTES del blit (oculta tras el
         planeta) y mitad frontal al final del frame (efecto Saturno). */
      const rt = reducedMotion ? 0 : time;
      const drawRings = (front: boolean) => {
        for (let i = 0; i < ORBIT_RINGS.length; i++) {
          const ring = ORBIT_RINGS[i];
          const tiltRad = ((ring.tilt + Math.sin(rt * 0.05 + i) * 4) * Math.PI) / 180;
          const rr = v.scale * ring.radius;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(tiltRad);
          ctx.scale(1, ring.squash);
          ctx.setLineDash([5, 11]);
          ctx.lineDashOffset = -rt * ring.speed * 60;
          ctx.beginPath();
          ctx.arc(0, 0, rr, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
          ctx.strokeStyle = ring.color + (front ? "4d" : "1f");
          ctx.lineWidth = front ? 1.4 : 1;
          ctx.stroke();
          ctx.restore();
          const a = rt * ring.speed + i * 2.1;
          const ax = Math.cos(a) * rr;
          const ay = Math.sin(a) * rr * ring.squash;
          const px = cx + ax * Math.cos(tiltRad) - ay * Math.sin(tiltRad);
          const py = cy + ax * Math.sin(tiltRad) + ay * Math.cos(tiltRad);
          if ((Math.sin(a) >= 0) === front) {
            ctx.save();
            ctx.fillStyle = ring.color + (front ? "cc" : "55");
            if (front) {
              ctx.shadowColor = ring.color;
              ctx.shadowBlur = 10;
            }
            ctx.beginPath();
            ctx.arc(px, py, front ? 2.2 : 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      };
      drawRings(false);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
      ctx.drawImage(off, 0, 0, w, h);

      /* Atmósfera volumétrica: limbo interior + halo exterior que respiran. */
      const limb = ctx.createRadialGradient(cx, cy, v.scale * 0.84, cx, cy, v.scale);
      limb.addColorStop(0, "rgba(0, 245, 255, 0)");
      limb.addColorStop(1, `rgba(0, 245, 255, ${(0.16 + breath * 0.1).toFixed(3)})`);
      ctx.fillStyle = limb;
      ctx.beginPath();
      ctx.arc(cx, cy, v.scale, 0, Math.PI * 2);
      ctx.fill();
      const halo = ctx.createRadialGradient(cx, cy, v.scale * 0.98, cx, cy, v.scale * 1.18);
      halo.addColorStop(0, "rgba(0, 245, 255, 0)");
      halo.addColorStop(0.55, `rgba(0, 245, 255, ${(0.14 + breath * 0.12).toFixed(3)})`);
      halo.addColorStop(1, "rgba(0, 245, 255, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, v.scale * 1.18, 0, Math.PI * 2);
      ctx.fill();
      hitsRef.current.length = 0;
      const proj = (lat: number, lon: number) => orthoProject(lat, lon, v, cx, cy);
      const glowBlur = reducedMotion ? 20 : 16 + breath * 34;

      /* Flota: sin shadowBlur por punto (~15k save/shadow/restore → FPS 1).
         Agrupamos por color; dos pasadas (halo + núcleo). */
      const frame = frameRef.current;
      if (frame) {
        const { ids, data } = frame;
        const byColor = new Map<string, { x: number; y: number; id: number }[]>();
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i];
          if (sel && id === sel.id) continue;
          const o = i * FLEET_STRIDE;
          if (data[o + 5] !== 1) continue;
          const p = proj(data[o], data[o + 1]);
          if (!p.visible) continue;
          const color = GROUP_COLORS[byIdRef.current.get(id)?.group ?? "other"];
          let bucket = byColor.get(color);
          if (!bucket) { bucket = []; byColor.set(color, bucket); }
          bucket.push({ x: p.x, y: p.y, id });
          hitsRef.current.push({ x: p.x, y: p.y, id });
        }
        for (const [color, pts] of byColor) {
          ctx.beginPath();
          for (const pt of pts) { ctx.moveTo(pt.x + 2.4, pt.y); ctx.arc(pt.x, pt.y, 2.4, 0, Math.PI * 2); }
          ctx.fillStyle = color + "33";
          ctx.fill();
        }
        for (const [color, pts] of byColor) {
          ctx.beginPath();
          for (const pt of pts) { ctx.moveTo(pt.x + 1.5, pt.y); ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2); }
          ctx.fillStyle = color;
          ctx.fill();
        }
      }

      const obs = observerRef.current;
      if (obs) {
        const p = proj(obs.latitude, obs.longitude);
        if (p.visible) {
          /* Punto del observador: núcleo naranja pulsante + onda expansiva doble. */
          ctx.save();
          const cycle = 2.4;
          const ph = reducedMotion ? 0.3 : (time % cycle) / cycle;
          for (const off of [0, 0.5]) {
            const w = (ph + off) % 1;
            ctx.strokeStyle = `rgba(255, 140, 60, ${(0.5 * (1 - w)).toFixed(3)})`;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4 + w * 26, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.shadowColor = "rgba(255,103,0,.9)";
          ctx.shadowBlur = glowBlur;
          const pulse = 1 + (reducedMotion ? 0 : 0.3 * Math.sin((time * Math.PI * 2) / cycle));
          ctx.fillStyle = "#ff8c3c";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.8 * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      const moon = getMoonPosition(nowRef.current);
      const moonProj = proj(moon.lat, moon.lon);
      if (moonProj.visible) {
        ctx.save();
        ctx.translate(moonProj.x, moonProj.y);
        ctx.shadowColor = "rgba(226, 232, 240, 0.9)";
        ctx.shadowBlur = glowBlur;
        ctx.fillStyle = "#e2e8f0";
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      /* Órbita del seleccionado: camino tenue + partículas fluyendo (dash
         animado) + estela cometa; recalculada por cubo de flota. */
      if (sel) {
        const bucketNow = Math.floor(nowRef.current.getTime() / FLEET_UPDATE_MS);
        const trackKey = `${sel.id}:${sel.line1}:${bucketNow}`;
        if (trackRef.current?.key !== trackKey) {
          trackRef.current = { key: trackKey, pts: groundTrack(sel, nowRef.current, { orbits: 1, samples: 96 }) };
        }
        const segs: { x: number; y: number }[][] = [];
        let pen = false;
        for (const f of trackRef.current.pts) {
          const q = proj(f.latDeg, f.lonDeg);
          if (q.visible) {
            if (!pen) { segs.push([]); pen = true; }
            segs[segs.length - 1].push({ x: q.x, y: q.y });
          } else {
            pen = false;
          }
        }
        const strokeSegs = () => {
          for (const s of segs) {
            if (s.length < 2) continue;
            ctx.beginPath();
            ctx.moveTo(s[0].x, s[0].y);
            for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y);
            ctx.stroke();
          }
        };
        ctx.strokeStyle = "rgba(0, 245, 255, 0.16)";
        ctx.lineWidth = 1;
        strokeSegs();
        ctx.save();
        ctx.strokeStyle = "rgba(0, 245, 255, 0.6)";
        ctx.lineWidth = 1.8;
        if (!reducedMotion) {
          ctx.setLineDash([2.5, 24]);
          ctx.lineDashOffset = -((time * 46) % 1000);
        }
        strokeSegs();
        ctx.restore();
        for (let k = 0; k < 5; k++) {
          const past = getFix(sel, new Date(nowRef.current.getTime() - (k + 1) * 150_000));
          if (!past) continue;
          const q = proj(past.latDeg, past.lonDeg);
          if (!q.visible) continue;
          ctx.fillStyle = `rgba(255, 160, 80, ${(0.34 - k * 0.06).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(q.x, q.y, 1.7 - k * 0.18, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (sel) {
        const fix = getFix(sel, nowRef.current);
        if (fix) {
          const p = proj(fix.latDeg, fix.lonDeg);
          if (p.visible) {
            ctx.save();
            ctx.shadowColor = "rgba(255, 103, 0, 0.9)";
            ctx.shadowBlur = glowBlur * 1.5;
            const pulse = 1 + 0.14 * Math.sin(t / 300);
            const halo = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 28 * pulse);
            halo.addColorStop(0, "rgba(255,103,0,0.5)");
            halo.addColorStop(1, "rgba(255,103,0,0)");
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 28 * pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = "#ff6700";
            ctx.fill();
            ctx.restore();
          }
        }
      }

      ctx.restore();

      drawRings(true);
    };

    raf = requestAnimationFrame(draw);

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add("st-globe-drag");
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const next = dragToRotation(viewRef.current, dx, dy);
      viewRef.current.latDeg = next.latDeg;
      viewRef.current.lonDeg = next.lonDeg;
      onUserPanRef.current?.();
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      canvas.releasePointerCapture(e.pointerId);
      canvas.classList.remove("st-globe-drag");
    };
    const onClick = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      let best: { id: number; d: number } | null = null;
      for (const h of hitsRef.current) {
        const d = Math.hypot(h.x - x, h.y - y);
        if (d < 12 && (!best || d < best.d)) best = { id: h.id, d };
      }
      if (best) {
        const sat = byIdRef.current.get(best.id);
        if (sat) onSelectRef.current(sat);
      } else {
        // Clic vacío: liberar el seguimiento (igual que al arrastrar).
        onUserPanRef.current?.();
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      v.scale = Math.max(80, Math.min(Math.min(w, h) * 0.9, v.scale * (e.deltaY > 0 ? 0.92 : 1.08)));
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeRaf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("wheel", onWheel);
    };

    // onSelect/onUserPan viven en refs: el canvas no se re-inicializa en cada render.
  }, []);

  return (
    <div ref={wrapRef} className="st-globe-wrap">
      <canvas ref={canvasRef} className="st-globe-canvas" />
      <div className="st-globe-controls">
        <button type="button" className={autoRotate ? "on" : ""} onClick={() => setAutoRotate((v) => !v)}>
          {autoRotate ? "⏸" : "▶"} Girar
        </button>
        <input
          type="range"
          min={0.2}
          max={3}
          step={0.1}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          title={`${speed.toFixed(1)}x`}
        />
        <span>{speed.toFixed(1)}x</span>
      </div>
      <div ref={tipRef} className="st-tip st-globe-tip" hidden />
    </div>
  );
}
