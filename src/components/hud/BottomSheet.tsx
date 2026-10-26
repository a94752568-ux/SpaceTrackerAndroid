/**
 * Bottom sheet compacto con tres alturas arrastrables (snap points) y cierre
 * por gesto — TAREA 3, brecha 2 del plano objetivo.
 *
 * - Snap: peek ≈25 % (mapa ≥ 60 % visible), media ≈55 %, casi completa ≈90 %.
 * - Asa arrastrable con Pointer Events (touch + ratón); la altura en vivo se
 *   aplica por ref con una custom property (sin re-render por frame).
 * - Fling rápido hacia abajo cerca de peek cierra el panel; un tap sobre el
 *   asa también cierra (conserva la UX previa del handle con onClick).
 * - Teclado: Escape/Enter/Espacio sobre el asa cierra (rol button).
 * - Landscape compact: el sheet es panel lateral estático (CSS existente);
 *   se pasa `snap={false}` y el drag queda desactivado.
 *
 * Sin dependencias nuevas: React + Pointer Events + CSS custom properties.
 */
import { memo, useCallback, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";

export type SheetSnap = "peek" | "half" | "tall";

/** Alturas objetivo en % del viewport (peek garantiza mapa ≥ 60 % visible). */
const SNAP_VH: Record<SheetSnap, number> = { peek: 25, half: 55, tall: 90 };
const SNAP_ORDER: SheetSnap[] = ["peek", "half", "tall"];
/** Límites de seguridad del drag, en % del viewport. */
const MIN_VH = 18;
const MAX_VH = 96;
/** Desplazamiento (px) bajo el cual un pointerup cuenta como tap (cerrar). */
const TAP_SLOP_PX = 8;
/** Velocidad vertical (px/ms) que califica como fling. */
const FLING_V_MS = 0.6;

/** Altura de viewport con fallback SSR (readViewport también degrada a 800). */
function viewportHeight(): number {
  return typeof window === "undefined" ? 800 : window.innerHeight;
}

interface BottomSheetProps {
  onClose: () => void;
  /** Altura inicial del sheet (por defecto media). */
  initialSnap?: SheetSnap;
  /** false desactiva snap y drag (landscape compact: panel lateral estático). */
  snap?: boolean;
  /** Etiqueta accesible del asa. */
  label?: string;
  children: ReactNode;
}

export function BottomSheet({
  onClose,
  initialSnap = "half",
  snap = true,
  label = "Arrastra para ajustar la altura, toca o pulsa Escape para cerrar",
  children,
}: BottomSheetProps) {
  const [snapName, setSnapName] = useState<SheetSnap>(initialSnap);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ y0: number; basePx: number; lastY: number; lastT: number; vy: number } | null>(null);

  const snapPx = useCallback((name: SheetSnap): number => (SNAP_VH[name] / 100) * viewportHeight(), []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!snap) return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      drag.current = {
        y0: e.clientY,
        basePx: ref.current?.getBoundingClientRect().height ?? snapPx(snapName),
        lastY: e.clientY,
        lastT: e.timeStamp,
        vy: 0,
      };
      setDragging(true);
    },
    [snap, snapName, snapPx],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const vh = viewportHeight();
    // dy > 0 → el dedo baja → el sheet se encoge.
    let px = d.basePx - (e.clientY - d.y0);
    px = Math.min((MAX_VH / 100) * vh, Math.max((MIN_VH / 100) * vh, px));
    el.style.setProperty("--sheet-h", `${Math.round(px)}px`);
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.vy = (e.clientY - d.lastY) / dt; // > 0: hacia abajo
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
  }, []);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      drag.current = null;
      setDragging(false);
      const el = ref.current;
      if (!d || !el) return;
      const dy = e.clientY - d.y0;
      if (Math.abs(dy) < TAP_SLOP_PX) {
        // Tap sobre el asa: cerrar (UX previa del handle).
        el.style.removeProperty("--sheet-h");
        onClose();
        return;
      }
      const vh = viewportHeight();
      const raw = el.style.getPropertyValue("--sheet-h");
      const px = raw ? parseFloat(raw) : d.basePx;
      // Cierre: arrastre claramente por debajo de peek, o fling descendente
      // desde la zona baja.
      const closePx = ((SNAP_VH.peek - 7) / 100) * vh;
      const flingClosePx = ((SNAP_VH.peek + 6) / 100) * vh;
      if (px <= closePx || (d.vy > FLING_V_MS && px <= flingClosePx)) {
        el.style.removeProperty("--sheet-h");
        onClose();
        return;
      }
      // Snap: en la dirección del fling si la hay; si no, el más cercano.
      let candidates: SheetSnap[] = SNAP_ORDER;
      if (d.vy > FLING_V_MS) {
        const lower = SNAP_ORDER.filter((s) => (SNAP_VH[s] / 100) * vh < px - 1);
        if (lower.length > 0) candidates = lower;
      } else if (d.vy < -FLING_V_MS) {
        const higher = SNAP_ORDER.filter((s) => (SNAP_VH[s] / 100) * vh > px + 1);
        if (higher.length > 0) candidates = higher;
      }
      const target = candidates.reduce<SheetSnap>(
        (best, s) =>
          Math.abs((SNAP_VH[s] / 100) * vh - px) < Math.abs((SNAP_VH[best] / 100) * vh - px) ? s : best,
        candidates[0] ?? snapName,
      );
      el.style.removeProperty("--sheet-h");
      setSnapName(target);
    },
    [onClose, snapName],
  );

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  return (
    <div
      ref={ref}
      className="st-bottom-sheet"
      data-snap={snap ? snapName : undefined}
      data-dragging={dragging || undefined}
      style={snap ? ({ "--sheet-vh": SNAP_VH[snapName] } as CSSProperties) : undefined}
    >
      <div
        className="st-sheet-handle"
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={snap ? undefined : onClose}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {children}
    </div>
  );
}

export default memo(BottomSheet);
