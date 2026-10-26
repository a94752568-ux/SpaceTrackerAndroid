/**
 * Tarea 4 — aplica parches a GlobeView y MapView desde el remoto actual.
 * Uso: node scripts/apply-task4-map.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GLOBE = join(ROOT, "src/components/map/GlobeView.tsx");
const MAP = join(ROOT, "src/components/map/MapView.tsx");

function mustReplace(text, old, neu, label) {
  if (!text.includes(old)) throw new Error(`No encontrado: ${label}`);
  return text.replace(old, neu);
}

let globe = readFileSync(GLOBE, "utf8");
if (globe.includes("fitScale")) {
  console.log("GlobeView ya tiene Tarea 4, se omite");
} else {
  globe = mustReplace(
    globe,
    `    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = wrap.clientWidth;
      h = wrap.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      off.width = canvas.width;
      off.height = canvas.height;
      if (viewRef.current.scale === 0) viewRef.current.scale = Math.min(w, h) * 0.42;
      cacheKey = "";
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);`,
    `    /** Escala que encaja el globo completo en el contenedor (relación 1:1, margen ~16%). */
    const fitScale = (cw: number, ch: number) => Math.max(40, Math.min(cw, ch) * 0.42);

    // Factor de zoom del usuario respecto al "fit" actual (1 = globo completo centrado).
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
      canvas.style.width = \`\${w}px\`;
      canvas.style.height = \`\${h}px\`;
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
    ro.observe(wrap);`,
    "GlobeView.resize",
  );

  globe = mustReplace(
    globe,
    `    const wheel = (e: WheelEvent) => {
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
      io.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);`,
    `    const wheel = (e: WheelEvent) => {
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
      io.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("pointerdown", onPtrDownPinch);
      canvas.removeEventListener("pointermove", onPtrMovePinch);
      canvas.removeEventListener("pointerup", onPtrUpPinch);
      canvas.removeEventListener("pointercancel", onPtrUpPinch);
      canvas.removeEventListener("wheel", wheel);`,
    "GlobeView.wheel+listeners",
  );

  writeFileSync(GLOBE, globe);
  console.log("OK GlobeView");
}

let map = readFileSync(MAP, "utf8");
if (map.includes("visualViewport") && map.includes("invRaf")) {
  console.log("MapView ya tiene Tarea 4, se omite");
} else {
  map = mustReplace(
    map,
    `    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      ro.disconnect();`,
    `    let invRaf = 0;
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
      window.removeEventListener("orientationchange", invalidate);`,
    "MapView.invalidate",
  );
  writeFileSync(MAP, map);
  console.log("OK MapView");
}

console.log("Tarea 4 aplicada.");
