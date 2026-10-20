/**
 * MoonWidget — Widget de fases lunares con estética HUD.
 * 
 * Muestra la fase lunar actual con:
 * - Representación gráfica SVG dinámica
 * - Nombre de la fase en español
 * - Porcentaje de iluminación
 */
import { memo, useMemo } from "react";

import { getMoonPhase } from "../../lib/space/moon-phase";

interface MoonWidgetProps {
  /** Fecha para calcular la fase lunar */
  date: Date;
}

export function MoonWidget({ date }: MoonWidgetProps) {
  const minuteBucket = Math.floor(date.getTime() / 60000);
  const moon = useMemo(() => getMoonPhase(new Date(minuteBucket * 60000)), [minuteBucket]);

  // Generar el path SVG para representar la fase lunar
  const moonPath = useMemo(() => {
    const { phase } = moon;
    const r = 16; // radio
    const cx = 16;
    const cy = 16;
    
    // Base: círculo completo (sombra de la luna)
    let d = `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r}`;
    
    // Parte iluminada depende de la fase
    // phase 0 = nueva (todo oscuro), phase 0.5 = llena (todo iluminado)
    const illumination = moon.illumination / 100;
    
    if (illumination > 0.01) {
      // Calcular el arco de iluminación
      const angle = phase * 2 * Math.PI; // 0 a 2π
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      
      // Para fases crecientes (0-0.5): iluminación desde la derecha
      // Para fases menguantes (0.5-1): iluminación desde la izquierda
      if (phase <= 0.5) {
        // Creciente: arco desde el lado derecho
        const largeArc = phase > 0.25 ? 1 : 0;
        d += ` M ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${x} ${y} A ${r} ${r} 0 ${largeArc} 0 ${cx} ${cy + r}`;
      } else {
        // Menguante: arco desde el lado izquierdo
        const largeArc = phase > 0.75 ? 1 : 0;
        d += ` M ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 0 ${x} ${y} A ${r} ${r} 0 ${largeArc} 1 ${cx} ${cy + r}`;
      }
    }
    
    return d;
  }, [moon]);

  return (
    <div className="st-moon-widget hud-panel">
      <svg width="32" height="32" viewBox="0 0 32 32" className="st-moon-icon">
        {/* Círculo base (sombra) */}
        <circle cx="16" cy="16" r="16" fill="#0a0f1e" />
        {/* Parte iluminada */}
        <path d={moonPath} fill="#e2e8f0" opacity={moon.illumination / 100} />
        {/* Brillo atmosférico */}
        <circle cx="16" cy="16" r="16" fill="none" stroke="rgba(226, 232, 240, 0.3)" strokeWidth="1" />
      </svg>
      <div className="st-moon-info">
        <div className="st-moon-phase">{moon.phaseName}</div>
        <div className="st-moon-illum">{Math.round(moon.illumination)}% iluminado</div>
      </div>
    </div>
  );
}

export default memo(MoonWidget);
