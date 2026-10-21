/**
 * PassCalculator — interfaz para cálculo de pases orbitales.
 *
 * Esta interfaz prepara la arquitectura para cálculo de pases visibles
 * sobre un observador. La implementación actual usa satellite.js (SGP4)
 * vía el módulo `propagate.ts`, pero esta capa permite:
 * - Sustituir el motor de propagación en el futuro
 * - Añadir caché de pases calculados
 * - Integrar con backend de cálculo si se requiere
 *
 * NOTA: La implementación real de predictPasses está en `propagate.ts`.
 * Este módulo es una fachada para facilitar futuras extensiones.
 */

import type { Observer, Pass, Sat } from "./types";

export interface PassCalculatorOptions {
  /** Horizonte de predicción en horas (por defecto 24) */
  horizonHours?: number;
  /** Elevación mínima en grados para considerar un pase visible (por defecto 0) */
  minElDeg?: number;
  /** Paso grueso en segundos para búsqueda de AOS/LOS (por defecto 30) */
  coarseStepSec?: number;
  /** Número máximo de pases a devolver (por defecto 12) */
  maxPasses?: number;
}

export interface PassCalculatorResult {
  passes: Pass[];
  /** Instante de inicio del cálculo (epoch ms UTC) */
  calculatedAt: number;
  /** Número de iteraciones realizadas (para métricas de rendimiento) */
  iterations: number;
}

/**
 * Calculadora de pases orbitales.
 *
 * Implementación actual: delega en `propagate.predictPasses`.
 * Futuro: podría añadir caché, backend remoto, o motor alternativo.
 */
export class PassCalculator {
  private cache = new Map<string, { result: PassCalculatorResult; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

  /**
   * Calcula pases visibles para un satélite sobre un observador.
   *
   * @param sat - Satélite con TLE válido
   * @param observer - Observador terrestre
   * @param from - Instante de inicio del cálculo (epoch ms UTC)
   * @param opts - Opciones de cálculo
   * @returns Resultado con pases y metadatos
   */
  async calculate(
    sat: Sat,
    observer: Observer,
    from: Date,
    opts: PassCalculatorOptions = {},
  ): Promise<PassCalculatorResult> {
    // Clave de caché: satId + observer + hora redondeada a 10 min
    const cacheKey = this.buildCacheKey(sat.id, observer, from);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    // Importación dinámica para evitar dependencia circular
    const { predictPasses } = await import("./propagate");

    const passes = predictPasses(sat, observer, from, {
      durationHours: opts.horizonHours ?? 24,
      coarseStepSec: opts.coarseStepSec ?? 30,
      maxPasses: opts.maxPasses ?? 12,
    });

    const result: PassCalculatorResult = {
      passes,
      calculatedAt: Date.now(),
      iterations: passes.length * 2, // Estimación aproximada
    };

    // Guardar en caché
    this.cache.set(cacheKey, {
      result,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });

    // Limpiar caché antigua
    this.pruneCache();

    return result;
  }

  /**
   * Calcula pases para múltiples satélites (útil para favoritos).
   *
   * @param sats - Array de satélites
   * @param observer - Observador terrestre
   * @param from - Instante de inicio
   * @param opts - Opciones de cálculo
   * @returns Mapa NORAD ID -> resultado
   */
  async calculateBatch(
    sats: Sat[],
    observer: Observer,
    from: Date,
    opts: PassCalculatorOptions = {},
  ): Promise<Map<number, PassCalculatorResult>> {
    const results = new Map<number, PassCalculatorResult>();

    // Procesar en paralelo con límite de concurrencia
    const BATCH_SIZE = 5;
    for (let i = 0; i < sats.length; i += BATCH_SIZE) {
      const batch = sats.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((sat) => this.calculate(sat, observer, from, opts)),
      );
      for (let j = 0; j < batch.length; j++) {
        results.set(batch[j].id, batchResults[j]);
      }
    }

    return results;
  }

  /**
   * Limpia entradas de caché expiradas.
   */
  private pruneCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Construye clave de caché basada en satélite, observador y tiempo.
   */
  private buildCacheKey(satId: number, observer: Observer, from: Date): string {
    const timeKey = Math.floor(from.getTime() / 600000); // 10 min buckets
    return `${satId}|${observer.latitude.toFixed(2)}|${observer.longitude.toFixed(2)}|${timeKey}`;
  }

  /**
   * Limpia toda la caché (útil para forzar recálculo).
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Devuelve estadísticas de caché (para debugging/telemetría).
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

/**
 * Instancia singleton para uso en toda la aplicación.
 */
export const passCalculator = new PassCalculator();
