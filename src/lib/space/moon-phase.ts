/**
 * Cálculo de fases lunares usando el ciclo sinódico.
 * 
 * Algoritmo basado en el ciclo sinódico medio de la Luna (~29.53058867 días)
 * a partir de una fecha base de Luna Nueva conocida.
 * 
 * Referencia: Luna Nueva el 6 de enero de 2000 a las 18:14 UTC.
 * Fuente: NASA/JPL HORIZONS System.
 */

export interface MoonPhase {
  /** Fase normalizada: 0.0 = Luna Nueva, 0.5 = Luna Llena, 1.0 = siguiente Luna Nueva */
  phase: number;
  /** Nombre descriptivo de la fase en español */
  phaseName: string;
  /** Porcentaje de iluminación visible (0% a 100%) */
  illumination: number;
}

/**
 * Fecha base de Luna Nueva conocida: 6 de enero de 2000, 18:14 UTC.
 * Timestamp en milisegundos.
 */
const NEW_MOON_2000 = Date.UTC(2000, 0, 6, 18, 14, 0);

/**
 * Ciclo sinódico medio de la Luna en días.
 */
const SYNODIC_MONTH_DAYS = 29.53058867;

/**
 * Calcula la fase lunar para una fecha dada.
 * 
 * @param date Fecha para calcular la fase lunar
 * @returns Objeto con phase (0-1), phaseName e illumination (0-100)
 */
export function getMoonPhase(date: Date): MoonPhase {
  const t = date.getTime();
  
  // Días desde la Luna Nueva de referencia
  const daysSinceNew = (t - NEW_MOON_2000) / (24 * 60 * 60 * 1000);
  
  // Ciclos sinódicos completos
  const cycles = daysSinceNew / SYNODIC_MONTH_DAYS;
  
  // Fase normalizada (0.0 a 1.0)
  const phase = cycles - Math.floor(cycles);
  
  // Iluminación: 0% en Luna Nueva, 100% en Luna Llena
  // Usamos coseno para simular la curva de iluminación
  const illumination = (1 - Math.cos(phase * 2 * Math.PI)) / 2 * 100;
  
  // Nombre de la fase
  const phaseName = getPhaseName(phase);
  
  return { phase, phaseName, illumination };
}

/**
 * Determina el nombre descriptivo de la fase basado en el valor normalizado.
 * 
 * Divisiones del ciclo:
 * - 0.00 - 0.03: Luna Nueva
 * - 0.03 - 0.22: Creciente
 * - 0.22 - 0.28: Cuarto Creciente
 * - 0.28 - 0.47: Gibosa Creciente
 * - 0.47 - 0.53: Luna Llena
 * - 0.53 - 0.72: Gibosa Menguante
 * - 0.72 - 0.78: Cuarto Menguante
 * - 0.78 - 0.97: Menguante
 * - 0.97 - 1.00: Luna Nueva
 */
function getPhaseName(phase: number): string {
  const p = phase;
  
  if (p < 0.03 || p >= 0.97) return "Luna Nueva";
  if (p < 0.22) return "Creciente";
  if (p < 0.28) return "Cuarto Creciente";
  if (p < 0.47) return "Gibosa Creciente";
  if (p < 0.53) return "Luna Llena";
  if (p < 0.72) return "Gibosa Menguante";
  if (p < 0.78) return "Cuarto Menguante";
  return "Menguante";
}

/**
 * Calcula el ángulo de fase en grados (0° = Luna Nueva, 180° = Luna Llena).
 */
export function getPhaseAngle(date: Date): number {
  const { phase } = getMoonPhase(date);
  return phase * 360;
}
