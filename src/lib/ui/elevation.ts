/**
 * Utilidad para obtener la elevación sobre el nivel del mar usando la API gratuita de Open-Meteo.
 * API: https://api.open-meteo.com/v1/elevation?latitude=LAT&longitude=LON
 * No requiere API key y tiene límites generosos para uso no comercial.
 */

/** Caché simple en memoria para evitar peticiones repetidas a las mismas coordenadas. */
const elevationCache = new Map<string, number>();

/**
 * Obtiene la elevación en metros sobre el nivel del mar para unas coordenadas dadas.
 * @param lat Latitud en grados
 * @param lon Longitud en grados
 * @param signal Opcional AbortSignal para cancelar la petición
 * @returns Elevación en metros, o null si la petición falla
 */
export async function fetchElevation(lat: number, lon: number, signal?: AbortSignal): Promise<number | null> {
  // Redondear a 4 decimales (~11m de precisión) para caché efectivo
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = elevationCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(6)}&longitude=${lon.toFixed(6)}`;
    const response = await fetch(url, { signal });
    
    // Manejar específicamente 429 (Too Many Requests)
    if (response.status === 429) {
      return null;
    }
    
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    // Open-Meteo devuelve { elevation: number } o null
    if (typeof data?.elevation === "number" && Number.isFinite(data.elevation)) {
      const rounded = Math.round(data.elevation);
      elevationCache.set(cacheKey, rounded);
      return rounded;
    }
    return null;
  } catch {
    // Error de red o parsing silencioso (incluye abort)
    return null;
  }
}

/** Limpia el caché de elevación (útil para tests o si se necesita frescura). */
export function clearElevationCache(): void {
  elevationCache.clear();
}
