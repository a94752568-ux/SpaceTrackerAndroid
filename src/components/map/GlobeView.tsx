/**
 * GlobeView — globo terráqueo en PROYECCIÓN ORTOGRÁFICA 2D con respiración canvas y alto rendimiento.
 *
 * Garantía SIN rotación perpetua: el globo está ESTÁTICO por defecto; el giro
 * es explícito (botón «Girar») y el centrado solo ocurre con lock de seguimiento.
 *
 * PERF 2026-10-30: flota agrupada por color SIN shadowBlur por punto
 * (antes ~15k save/shadow/restore → FPS 1 en GLOBO).
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
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const trackedRef = useRef(tracked);
  trackedRef.current = tracked;
  const observerRef = useRef(observer);
  observerRef.current = observer;
  const nowRef = useRef(now);
  nowRef.current = now;
  const centerTriggerRef = useRef(0);

  useEffect(() => {
    byIdRef.current = new Map(sats.map((s) => [s.id, s]));
  }, [sats]);

  useEffect(() => {
    const client = new FleetClient();
    fleetRef.current = client;
    return () => {
      client.dispose();
      fleetRef.current = null;
      frameRef.current = null;
    };
  }, []);

  const bucket = Math.floor(now.getTime() / FLEET_UPDATE_MS);
  useEffect(() => {
    const client = fleetRef.current;
    if (!client || sats.length === 0) return;
    let cancelled = false;
    client.request(sats, now).then((f) => {
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
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
      ctx.drawImage(off, 0, 0, w, h);
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
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = "#ff6700";
            ctx.fill();
            ctx.restore();
          }
        }
      }

      ctx.restore();
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
      onUserPan?.();
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
        if (sat) onSelect(sat);
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
  }, [onSelect, onUserPan]);

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
