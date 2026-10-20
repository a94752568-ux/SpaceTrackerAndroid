/**
 * GlobeView — globo terráqueo en PROYECCIÓN ORTOGRÁFICA 2D (sin WebGL).
 *
 * Render: un único <canvas> con:
 *  - caché offscreen de la esfera (halo atmosférico, océano, graticula y
 *    continentes 110 m vía d3-geo + world-atlas), repintada solo cuando cambia
 *    rotación/zoom (clave cuantizada a 0.1°/1 px);
 *  - capa dinámica por frame: flota (frames del Web Worker SGP4), trayectoria,
 *    huella, observador y seleccionado con retícula naranja — todo con
 *    backface culling (cos c > 0).
 * Interacción: arrastre = rotación, rueda = zoom, click/tap = selección
 * (hit-test sobre puntos proyectados), hover = tooltip. Auto-rotación suave
 * en reposo; `tracked` centra el globo en el satélite con lerp.
 */
import { useEffect, useRef } from "react";
// Módulos venderizados (ver src/vendor/VENDORED.md): el zip funciona sin
// reinstalar node_modules en entornos con instalaciones externas antiguas.
import { geoGraticule10, geoOrthographic, geoPath } from "../../vendor/d3-geo/index.js";
import { feature } from "../../vendor/topojson-client/index.js";
import landRaw from "../../vendor/land-110m.json?raw";

import { FLEET_STRIDE, FLEET_UPDATE_MS } from "../../lib/space/fleet-compute";
import { FleetClient, type FleetFrame } from "../../lib/space/fleet-worker-client";
import { dragToRotation, orthoProject, wrapLonDeg, type OrthoView } from "../../lib/space/ortho";
import { footprint, getFix, groundTrack } from "../../lib/space/propagate";
import { getMoonPosition } from "../../lib/space/moon-position";
import type { Fix, Observer, Sat } from "../../lib/space/types";
import { GROUP_COLORS } from "../../lib/ui/colors";
import { escapeHtml } from "../../lib/ui/markers";

interface GlobeViewProps {
  sats: Sat[];
  selected: Sat | null;
  observer: Observer | null;
  now: Date;
  tracked: boolean;
  onSelect: (sat: Sat) => void;
  onUserPan?: () => void;
  /** Trigger para centrar el globo en el observador (incrementar para activar). */
  centerOnObserverTrigger?: number;
  isGlitching?: boolean;
}

/* Continentes (54 KB embebidos, parseados una vez) + graticula de 10°. */
const topo = JSON.parse(landRaw) as unknown as { objects: { land: unknown } };
const LAND = feature(topo as never, topo.objects.land as never) as unknown as GeoJSON.GeoJsonObject;
const GRATICULE = geoGraticule10();

export default function GlobeView({
  sats,
  selected,
  observer,
  now,
  tracked,
  onSelect,
  onUserPan,
  centerOnObserverTrigger,
  isGlitching = false,
}: GlobeViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  const viewRef = useRef<OrthoView>({ latDeg: 18, lonDeg: -30, scale: 0 });
  const fleetRef = useRef<FleetClient | null>(null);
  const frameRef = useRef<FleetFrame | null>(null);
  const satsRef = useRef(sats);
  satsRef.current = sats;
  const byIdRef = useRef<Map<number, Sat>>(new Map());
  const hitsRef = useRef<{ x: number; y: number; id: number }[]>([]);
  const dragRef = useRef<{ on: boolean; x: number; y: number; moved: number }>({
    on: false,
    x: 0,
    y: 0,
    moved: 0,
  });
  const nowRef = useRef(now);
  nowRef.current = now;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const trackedRef = useRef(tracked);
  trackedRef.current = tracked;
  const observerRef = useRef(observer);
  observerRef.current = observer;
  const isGlitchingRef = useRef(isGlitching);
  isGlitchingRef.current = isGlitching;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onUserPanRef = useRef(onUserPan);
  onUserPanRef.current = onUserPan;
  const centerTriggerRef = useRef(0);
  const trackCacheRef = useRef<{ key: string; back: Fix[]; fwd: Fix[]; ring: { latDeg: number; lonDeg: number }[] } | null>(null);
  const lastPostRef = useRef(0);

  /* Catálogo → worker + índice por id. */
  useEffect(() => {
    if (!fleetRef.current) fleetRef.current = new FleetClient();
    fleetRef.current.setCatalog(sats);
    byIdRef.current = new Map(sats.map((s) => [s.id, s]));
    frameRef.current = null;
  }, [sats]);

  /* Frames de flota en cubos de 2 s (misma cadencia que el mapa plano). */
  const bucket = Math.floor(now.getTime() / FLEET_UPDATE_MS);
  useEffect(() => {
    const fleet = fleetRef.current;
    if (!fleet) return;
    if (Date.now() - lastPostRef.current < 250) return;
    lastPostRef.current = Date.now();
    void fleet.request(nowRef.current.getTime()).then((f) => {
      if (f) frameRef.current = f;
    });
  }, [sats, bucket]);

  /* --- centrado en observador --- */
  useEffect(() => {
    if (centerOnObserverTrigger === undefined || !observer) return;
    centerTriggerRef.current = centerOnObserverTrigger;
  }, [centerOnObserverTrigger, observer]);

  useEffect(() => {
    if (centerTriggerRef.current === 0 || !observer) return;
    viewRef.current.latDeg = observer.latitude;
    viewRef.current.lonDeg = observer.longitude;
    centerTriggerRef.current = 0;
  }, [centerTriggerRef.current, observer]);

  /* Bucle de render + interacción. */
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    const off = document.createElement("canvas");
    const octx = off.getContext("2d")!;
    let cacheKey = "";

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = wrap.clientWidth;
      h = wrap.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      off.width = canvas.width;
      off.height = canvas.height;
      if (viewRef.current.scale === 0) viewRef.current.scale = Math.min(w, h) * 0.36;
      cacheKey = "";
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    /* ---- esfera estática (halo + océano + graticula + tierra) en offscreen ---- */
    const drawEarth = () => {
      const v = viewRef.current;
      const cx = w / 2;
      const cy = h / 2;
      const projection = geoOrthographic()
        .rotate([-v.lonDeg, -v.latDeg])
        .scale(v.scale)
        .translate([cx, cy]);
      const path = geoPath(projection, octx as unknown as CanvasRenderingContext2D);
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      octx.clearRect(0, 0, w, h);

      // Halo atmosférico exterior (gradiente radial cian)
      const halo = octx.createRadialGradient(cx, cy, v.scale * 0.98, cx, cy, v.scale * 1.22);
      halo.addColorStop(0, "rgba(34, 211, 238, 0.30)");
      halo.addColorStop(0.45, "rgba(34, 211, 238, 0.10)");
      halo.addColorStop(1, "rgba(34, 211, 238, 0)");
      octx.fillStyle = halo;
      octx.beginPath();
      octx.arc(cx, cy, v.scale * 1.22, 0, Math.PI * 2);
      octx.fill();

      // Océano con sombreado de limbo
      const ocean = octx.createRadialGradient(
        cx - v.scale * 0.35,
        cy - v.scale * 0.35,
        v.scale * 0.2,
        cx,
        cy,
        v.scale,
      );
      ocean.addColorStop(0, "#0c1626");
      ocean.addColorStop(0.7, "#071019");
      ocean.addColorStop(1, "#030508");
      octx.beginPath();
      path({ type: "Sphere" } as never);
      octx.fillStyle = ocean;
      octx.fill();

      // Graticula técnica
      octx.beginPath();
      path(GRATICULE as never);
      octx.strokeStyle = "rgba(148, 163, 184, 0.10)";
      octx.lineWidth = 0.6;
      octx.stroke();

      // Continentes 110 m
      octx.beginPath();
      path(LAND as never);
      octx.fillStyle = "rgba(148, 163, 184, 0.13)";
      octx.fill();
      octx.strokeStyle = "rgba(34, 211, 238, 0.30)";
      octx.lineWidth = 0.7;
      octx.stroke();

      // Limbo luminoso
      octx.beginPath();
      octx.arc(cx, cy, v.scale, 0, Math.PI * 2);
      octx.strokeStyle = "rgba(34, 211, 238, 0.55)";
      octx.lineWidth = 1.2;
      octx.shadowColor = "rgba(34, 211, 238, 0.8)";
      octx.shadowBlur = 18;
      octx.stroke();
      octx.shadowBlur = 0;
    };

    /* ------------------------------- frame ------------------------------- */
    let raf = 0;
    let prevT = performance.now();
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(100, t - prevT);
      prevT = t;
      const v = viewRef.current;
      const cx = w / 2;
      const cy = h / 2;
      const sel = selectedRef.current;

      // SIN rotación perpetua: el globo queda estático en la última posición
      // del usuario. El centro solo se interpola suavemente (constante de
      // tiempo 250 ms, independiente de FPS) cuando hay satélite seleccionado
      // Y el modo seguimiento (lock) activo.
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

      const key = `${v.lonDeg.toFixed(1)}|${v.latDeg.toFixed(1)}|${Math.round(v.scale)}`;
      if (key !== cacheKey) {
        cacheKey = key;
        drawEarth();
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(off, 0, 0, w, h);
      hitsRef.current.length = 0;

      const proj = (lat: number, lon: number) => orthoProject(lat, lon, v, cx, cy);

      // Trayectoria + huella del seleccionado (caché por minuto)
      const minuteKey = `${sel?.id ?? 0}|${Math.floor(nowRef.current.getTime() / 60000)}`;
      if (sel && trackCacheRef.current?.key !== minuteKey) {
        const periodMs = 92 * 60000;
        trackCacheRef.current = {
          key: minuteKey,
          back: groundTrack(sel, new Date(nowRef.current.getTime() - periodMs), { orbits: 1, samples: 70 }),
          fwd: groundTrack(sel, nowRef.current, { orbits: 1, samples: 70 }),
          ring: footprint(sel, nowRef.current)?.ring ?? [],
        };
      }
      const tc = sel ? trackCacheRef.current : null;
      if (tc) {
        const drawTrack = (pts: Fix[], style: string, width: number) => {
          ctx.beginPath();
          let pen = false;
          let prev: { x: number; y: number } | null = null;
          for (const f of pts) {
            const p = proj(f.latDeg, f.lonDeg);
            if (!p.visible || (prev && Math.hypot(p.x - prev.x, p.y - prev.y) > v.scale * 0.9)) {
              pen = false;
              prev = p;
              continue;
            }
            if (!pen) {
              ctx.moveTo(p.x, p.y);
              pen = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
            prev = p;
          }
          ctx.strokeStyle = style;
          ctx.lineWidth = width;
          ctx.stroke();
        };
        drawTrack(tc.back, "rgba(34, 211, 238, 0.16)", 1);
        drawTrack(tc.fwd, "rgba(34, 211, 238, 0.5)", 1.4);
        drawTrack(
          [...tc.ring, tc.ring[0]] as unknown as Fix[],
          "rgba(34, 211, 238, 0.35)",
          1,
        );
      }

      // Flota desde el worker (backface culling)
      const frame = frameRef.current;
      if (frame) {
        const { ids, data } = frame;
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i];
          if (sel && id === sel.id) continue;
          const o = i * FLEET_STRIDE;
          if (data[o + 5] !== 1) continue;
          const p = proj(data[o], data[o + 1]);
          if (!p.visible) continue;
          const jitX = isGlitchingRef.current ? (Math.random() - 0.5) * 4 : 0;
          const jitY = isGlitchingRef.current ? (Math.random() - 0.5) * 4 : 0;
          const px = p.x + jitX;
          const py = p.y + jitY;
          const color = GROUP_COLORS[byIdRef.current.get(id)?.group ?? "other"];
          ctx.beginPath();
          ctx.arc(px, py, 3.2, 0, Math.PI * 2);
          ctx.fillStyle = color + "2e";
          ctx.fill();
          ctx.beginPath();
          ctx.arc(px, py, 1.6, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          hitsRef.current.push({ x: px, y: py, id });
        }
      }

      // Observador
      const obs = observerRef.current;
      if (obs) {
        const p = proj(obs.latitude, obs.longitude);
        if (p.visible) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = "#ff6700";
          ctx.shadowColor = "rgba(255,103,0,.8)";
          ctx.shadowBlur = 8;
          ctx.fillRect(-3, -3, 6, 6);
          ctx.restore();
        }
      }

      // Luna
      const moon = getMoonPosition(nowRef.current);
      const moonProj = proj(moon.lat, moon.lon);
      if (moonProj.visible) {
        ctx.save();
        ctx.translate(moonProj.x, moonProj.y);
        ctx.shadowColor = "rgba(226, 232, 240, 0.8)";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#e2e8f0";
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "10px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
        ctx.fillText(" 🌙 Luna", 6, 0);
        ctx.restore();
      }

      // Seleccionado: halo pulsante + retícula naranja + núcleo
      if (sel) {
        const fix = getFix(sel, nowRef.current);
        if (fix) {
          const p = proj(fix.latDeg, fix.lonDeg);
          if (p.visible) {
            const pulse = 1 + 0.12 * Math.sin(t / 320);
            const halo = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 26 * pulse);
            halo.addColorStop(0, "rgba(255,103,0,0.42)");
            halo.addColorStop(1, "rgba(255,103,0,0)");
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 26 * pulse, 0, Math.PI * 2);
            ctx.fill();

            ctx.save();
            ctx.strokeStyle = "#ff6700";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.lineDashOffset = -t / 40; // punteado móvil
            ctx.beginPath();
            ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            for (const [sx, sy] of [
              [-1, -1],
              [1, -1],
              [1, 1],
              [-1, 1],
            ] as const) {
              ctx.beginPath();
              ctx.moveTo(p.x + sx * 17, p.y + sy * 17 - sy * 6);
              ctx.lineTo(p.x + sx * 17, p.y + sy * 17);
              ctx.lineTo(p.x + sx * 17 - sx * 6, p.y + sy * 17);
              ctx.stroke();
            }
            ctx.shadowColor = "rgba(255,103,0,.9)";
            ctx.shadowBlur = 12;
            ctx.fillStyle = "#ffb27a";
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }
    };
    raf = requestAnimationFrame(draw);

    /* ---------------------------- interacción ---------------------------- */
    const hitAt = (x: number, y: number) => {
      let best: { x: number; y: number; id: number } | null = null;
      let bd = 14;
      for (const hit of hitsRef.current) {
        const d = Math.hypot(hit.x - x, hit.y - y);
        if (d < bd) {
          bd = d;
          best = hit;
        }
      }
      return best;
    };
    const local = (e: PointerEvent | WheelEvent | MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      dragRef.current = { on: true, x: e.clientX, y: e.clientY, moved: 0 };
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add("st-globe-drag");
      onUserPanRef.current?.(); // el arrastre manual libera el seguimiento
    };
    const move = (e: PointerEvent) => {
      const { x, y } = local(e);
      if (dragRef.current.on) {
        const dx = e.clientX - dragRef.current.x;
        const dy = e.clientY - dragRef.current.y;
        dragRef.current.x = e.clientX;
        dragRef.current.y = e.clientY;
        dragRef.current.moved += Math.abs(dx) + Math.abs(dy);
        // Invertir dx para que arrastrar a la derecha rote el globo hacia el oeste (comportamiento natural)
        const rot = dragToRotation(viewRef.current, -dx, dy);
        viewRef.current.latDeg = rot.latDeg;
        viewRef.current.lonDeg = rot.lonDeg;
        return;
      }
      const hit = hitAt(x, y);
      const tip = tipRef.current;
      if (tip) {
        if (hit) {
          const s = byIdRef.current.get(hit.id);
          if (s) {
            tip.innerHTML = `<b>${escapeHtml(s.name)}</b><span class="st-tip-norad">NORAD ${s.id}</span>`;
            tip.style.left = `${x}px`;
            tip.style.top = `${y}px`;
            tip.hidden = false;
            canvas.classList.add("st-globe-hit");
          }
        } else {
          tip.hidden = true;
          canvas.classList.remove("st-globe-hit");
        }
      }
    };
    const up = (e: PointerEvent) => {
      const wasDrag = dragRef.current.on;
      const moved = dragRef.current.moved;
      dragRef.current.on = false;
      canvas.classList.remove("st-globe-drag");
      if (!wasDrag || moved >= 4) return; // arrastre real: el usuario ya tomó el control
      const { x, y } = local(e);
      const hit = hitAt(x, y);
      if (hit) {
        const s = byIdRef.current.get(hit.id);
        if (s) onSelectRef.current(s);
      } else {
        // Clic en área vacía: el globo se detiene en su posición actual.
        onUserPanRef.current?.();
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      v.scale = Math.max(80, Math.min(900, v.scale * Math.exp(-e.deltaY * 0.0012)));
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
      fleetRef.current?.terminate();
      fleetRef.current = null;
    };
  }, []);

  return (
    <div className="st-globe-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="st-globe"
        style={
          isGlitching
            ? {
                filter:
                  "hue-rotate(90deg) contrast(180%) drop-shadow(2px 0px 0px #FF2DAA) drop-shadow(-2px 0px 0px #00E5FF)",
              }
            : undefined
        }
        aria-label="Globo ortográfico de satélites"
      />
      <div ref={tipRef} className="st-tip st-globe-tip" hidden />
    </div>
  );
}
