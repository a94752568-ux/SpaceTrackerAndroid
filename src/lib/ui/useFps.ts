/**
 * FPS real del hilo principal (media móvil de 1 s) para el chip de estado del
 * dock. Un solo rAF loop; en SSR/dev-server sin rAF devuelve el valor inicial.
 */
import { useEffect, useState } from "react";

export function useFps(initial = 60): number {
  const [fps, setFps] = useState(initial);
  useEffect(() => {
    if (typeof requestAnimationFrame === "undefined") return;
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      frames++;
      const dt = t - last;
      if (dt >= 1000) {
        setFps(Math.max(1, Math.min(240, Math.round((frames * 1000) / dt))));
        frames = 0;
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return fps;
}
