/**
 * Efecto teletipo/descodificado para telemetría: al cambiar el texto, los
 * caracteres se "descodifican" desde glifos hex durante ~400 ms y se fijan de
 * izquierda a derecha. SSR-safe: el estado inicial es el texto final.
 */
import { useEffect, useRef, useState } from "react";

const GLYPHS = "0123456789ABCDEF#*+·";

export function useScramble(text: string, durationMs = 420): string {
  const [out, setOut] = useState(text);
  const prevRef = useRef(text);

  useEffect(() => {
    if (typeof requestAnimationFrame === "undefined") {
      setOut(text);
      return;
    }
    if (prevRef.current === text) return;
    prevRef.current = text;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const locked = Math.floor(p * text.length);
      let s = text.slice(0, locked);
      for (let i = locked; i < text.length; i++) {
        const c = text[i];
        s += c === " " || c === "." || c === "°" ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      setOut(s);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setOut(text);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, durationMs]);

  return out;
}
