/**
 * GlobeView — globo terráqueo en PROYECCIÓN ORTOGRÁFICA 2D con respiración canvas y alto rendimiento.
 *
 * Garantía SIN rotación perpetua: el globo está ESTÁTICO por defecto; el giro
 * es explícito (botón «Girar») y el centrado solo ocurre con lock de seguimiento.
 */
import { useEffect, useRef, useState } from "react";
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
  centerOnObserverTrigger?: number;
  isGlitching?: boolean;
}

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
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onUserPanRef = useRef(onUserPan);
  onUserPanRef.current = onUserPan;
  const centerTriggerRef = useRef(0);
  const trackCacheRef = useRef<{ key: string; back: Fix[]; fwd: Fix[]; ring: { latDeg: number; lonDeg: number }[] } | null>(null);
  const lastPostRef = useRef(0);

  useEffect(() => {
    if (!fleetRef.current) fleetRef.current = new FleetClient();
    fleetRef.current.setCatalog(sats);
    byIdRef.current = new Map(sats.map((s) => [s.id, s]));
    frameRef.current = null;
  }, [sats]);

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

    /** Escala que encaja el globo completo (1:1, margen ~20%). */
    const fitScale = (cw: number, ch: number) => Math.max(40, Math.min(cw, ch) * 0.40);

    let userZoom = 1;
    let prevFit = 0;
    let resizeRaf = 0;

    const resize = () => {
      const nextW = Math.max(1, wrap.clientWidth);
      const nextH = Math.max(1, wrap.clientHeight);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = nextW;
      h = nextH;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      off.width = canvas.width;
      off.height = canvas.height;

      const fit = fitScale(w, h);
      if (viewRef.current.scale === 0 || prevFit === 0) {
        viewRef.current.scale = fit;
        userZoom = 1;
      } else {
        userZoom = viewRef.current.scale / prevFit;
        viewRef.current.scale = Math.max(40, Math.min(fit * 3.5, fit * userZoom));
      }
      prevFit = fit;
      cacheKey = "";
    };

    const scheduleResize = () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(resize);
    };

    resize();
    const ro = new ResizeObserver(scheduleResize);
    ro.observe(wrap);

    const drawEarth = () => {
      const v = viewRef.current;
      const cx = w / 2;
      const cy = h / 2 - 14;
      const projection = geoOrthographic()
        .rotate([-v.lonDeg, -v.latDeg])
        .scale(v.scale)
        .translate([cx, cy]);
      const path = geoPath(projection, octx as unknown as CanvasRenderingContext2D);
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      octx.clearRect(0, 0, w, h);

      // Halo atmosférico
      const halo = octx.createRadialGradient(cx, cy, v.scale * 0.98, cx, cy, v.scale * 1.25);
      halo.addColorStop(0, "rgba(0, 229, 255, 0.35)");
      halo.addColorStop(0.5, "rgba(255, 103, 0, 0.12)");
      halo.addColorStop(1, "rgba(0, 0, 0, 0)");
      octx.fillStyle = halo;
      octx.beginPath();
      octx.arc(cx, cy, v.scale * 1.25, 0, Math.PI * 2);
      octx.fill();

      // Océano
      const ocean = octx.createRadialGradient(
        cx - v.scale * 0.35,
        cy - v.scale * 0.35,
        v.scale * 0.2,
        cx,
        cy,
        v.scale,
      );
      ocean.addColorStop(0, "#081326");
      ocean.addColorStop(0.7, "#040914");
      ocean.addColorStop(1, "#010306");
      octx.beginPath();
      path({ type: "Sphere" } as never);
      octx.fillStyle = ocean;
      octx.fill();

      // Graticula técnica
      octx.beginPath();
      path(GRATICULE as never);
      octx.strokeStyle = "rgba(0, 229, 255, 0.12)";
      octx.lineWidth = 0.6;
      octx.stroke();

      // Continentes
      octx.beginPath();
      path(LAND as never);
      octx.fillStyle = "rgba(148, 163, 184, 0.16)";
      octx.fill();
      octx.strokeStyle = "rgba(0, 229, 255, 0.40)";
      octx.lineWidth = 0.8;
      octx.stroke();

      // Limbo luminoso
      octx.beginPath();
      octx.arc(cx, cy, v.scale, 0, Math.PI * 2);
      octx.strokeStyle = "rgba(0, 229, 255, 0.70)";
      octx.lineWidth = 1.4;
      octx.shadowColor = "rgba(0, 229, 255, 0.9)";
      octx.shadowBlur = 20;
      octx.stroke();
      octx.shadowBlur = 0;
    };

    let raf = 0;
    let prevT = performance.now();
    const FRAME_INTERVAL = 1000 / 60; // 60 FPS cap for high performance
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

      // Cuantizar key para evitar redibujos offscreen innecesarios (mejora de rendimiento)
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

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);

      ctx.drawImage(off, 0, 0, w, h);
      hitsRef.current.length = 0;

      const proj = (lat: number, lon: number) => orthoProject(lat, lon, v, cx, cy);

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

      ctx.globalCompositeOperation = "lighter";
      const glowBaseAlpha = reducedMotion ? 0.4 : 0.35 + breath * 0.60;
      const glowBlur = reducedMotion ? 20 : 16 + breath * 34;
      const glowColor = `rgba(0, 229, 255, ${glowBaseAlpha})`;

      if (tc) {
        const drawTrackPasses = (pts: Fix[], style: string, width: number) => {
          ctx.save();
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = glowBlur * 1.5;
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
            if (!pen) { ctx.moveTo(p.x, p.y); pen = true; }
            else { ctx.lineTo(p.x, p.y); }
            prev = p;
          }
          ctx.strokeStyle = style;
          ctx.lineWidth = width * 2;
          ctx.stroke();
          ctx.restore();

          ctx.beginPath();
          pen = false;
          prev = null;
          for (const f of pts) {
            const p = proj(f.latDeg, f.lonDeg);
            if (!p.visible || (prev && Math.hypot(p.x - prev.x, p.y - prev.y) > v.scale * 0.9)) {
              pen = false;
              prev = p;
              continue;
            }
            if (!pen) { ctx.moveTo(p.x, p.y); pen = true; }
            else { ctx.lineTo(p.x, p.y); }
            prev = p;
          }
          ctx.strokeStyle = style;
          ctx.lineWidth = width;
          ctx.stroke();
        };

        drawTrackPasses(tc.back, "rgba(0, 229, 255, 0.25)", 1);
        drawTrackPasses(tc.fwd, "rgba(255, 103, 0, 0.8)", 1.8);
        drawTrackPasses([...tc.ring, tc.ring[0]] as unknown as Fix[], "rgba(0, 229, 255, 0.5)", 1.2);
      }

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
          const px = p.x;
          const py = p.y;
          const color = GROUP_COLORS[byIdRef.current.get(id)?.group ?? "other"];

          ctx.save();
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = glowBlur;
          ctx.beginPath();
          ctx.arc(px, py, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = color + "44";
          ctx.fill();
          ctx.restore();

          ctx.beginPath();
          ctx.arc(px, py, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();

          hitsRef.current.push({ x: px, y: py, id });
        }
      }

      const obs = observerRef.current;
      if (obs) {
        const p = proj(obs.latitude, obs.longitude);
        if (p.visible) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = "#ff6700";
          ctx.shadowColor = "rgba(255,103,0,.9)";
          ctx.shadowBlur = glowBlur;
          ctx.fillRect(-3.5, -3.5, 7, 7);
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
        ctx.font = "10px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
        ctx.fillText(" 🌙 Luna", 6, 0);
        ctx.restore();
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

            ctx.strokeStyle = "#ff6700";
            ctx.lineWidth = 1.2;
            ctx.setLineDash([4, 4]);
            ctx.lineDashOffset = -t / 35;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            for (const [sx, sy] of [
              [-1, -1],
              [1, -1],
              [1, 1],
              [-1, 1],
            ] as const) {
              ctx.beginPath();
              ctx.moveTo(p.x + sx * 18, p.y + sy * 18 - sy * 6);
              ctx.lineTo(p.x + sx * 18, p.y + sy * 18);
              ctx.lineTo(p.x + sx * 18 - sx * 6, p.y + sy * 18);
              ctx.stroke();
            }

            ctx.fillStyle = "#ffb27a";
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }

      ctx.restore();
    };
    raf = requestAnimationFrame(draw);

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
      onUserPanRef.current?.();
    };
    const move = (e: PointerEvent) => {
      const { x, y } = local(e);
      if (dragRef.current.on) {
        const dx = e.clientX - dragRef.current.x;
        const dy = e.clientY - dragRef.current.y;
        dragRef.current.x = e.clientX;
        dragRef.current.y = e.clientY;
        dragRef.current.moved += Math.abs(dx) + Math.abs(dy);
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
      if (!wasDrag || moved >= 4) return;
      const { x, y } = local(e);
      const hit = hitAt(x, y);
      if (hit) {
        const s = byIdRef.current.get(hit.id);
        if (s) onSelectRef.current(s);
      } else {
        onUserPanRef.current?.();
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const fit = fitScale(w || wrap.clientWidth, h || wrap.clientHeight);
      const next = v.scale * Math.exp(-e.deltaY * 0.0012);
      v.scale = Math.max(fit * 0.55, Math.min(fit * 3.5, next));
      userZoom = v.scale / fit;
    };

    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStartDist = 0;
    let pinchStartScale = 0;
    const onPtrDownPinch = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        pinchStartScale = viewRef.current.scale;
        dragRef.current.on = false;
      }
    };
    const onPtrMovePinch = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size !== 2 || pinchStartDist <= 0) return;
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const fit = fitScale(w || wrap.clientWidth, h || wrap.clientHeight);
      const next = pinchStartScale * (dist / pinchStartDist);
      viewRef.current.scale = Math.max(fit * 0.55, Math.min(fit * 3.5, next));
      userZoom = viewRef.current.scale / fit;
      onUserPanRef.current?.();
    };
    const onPtrUpPinch = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStartDist = 0;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("pointerdown", onPtrDownPinch);
    canvas.addEventListener("pointermove", onPtrMovePinch);
    canvas.addEventListener("pointerup", onPtrUpPinch);
    canvas.addEventListener("pointercancel", onPtrUpPinch);
    canvas.addEventListener("wheel", wheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeRaf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("pointerdown", onPtrDownPinch);
      canvas.removeEventListener("pointermove", onPtrMovePinch);
      canvas.removeEventListener("pointerup", onPtrUpPinch);
      canvas.removeEventListener("pointercancel", onPtrUpPinch);
      canvas.removeEventListener("wheel", wheel);
      fleetRef.current?.terminate();
      fleetRef.current = null;
    };
  }, []);

  return (
    <div className="st-globe-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} className="st-globe" aria-label="Globo ortográfico de satélites" />
      <div className="st-globe-controls">
        <button
          className={autoRotate ? "st-primary" : "st-ghost"}
          onClick={() => setAutoRotate((v) => !v)}
          title="Auto-rotación del globo"
        >
          {autoRotate ? "⏸ Pausa" : "▶ Girar"}
        </button>
        <input
          type="range"
          min="0.2"
          max="5"
          step="0.2"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          title="Velocidad de rotación"
        />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--accent)" }}>
          {speed.toFixed(1)}x
        </span>
      </div>
      <div ref={tipRef} className="st-tip st-globe-tip" hidden />
    </div>
  );
}
