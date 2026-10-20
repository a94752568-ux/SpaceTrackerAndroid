/**
 * Utilidad para obtener la elevación sobre el nivel del mar usando la API gratuita de Open-Meteo.
 * API: https://api.open-meteo.com/v1/elevation?latitude=LAT&longitude=LON
 * No requiere API key y tiene límites generosos para uso no comercial.
 */

/**
 * Obtiene la elevación en metros sobre el nivel del mar para unas coordenadas dadas.
 * @param lat Latitud en grados
 * @param lon Longitud en grados
 * @returns Elevación en metros, o null si la petición falla
 */
export async function fetchElevation(lat: number, lon: number): Promise<number | null> {
  try {
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(6)}&longitude=${lon.toFixed(6)}`;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    // Open-Meteo devuelve { elevation: number } o null
    if (typeof data?.elevation === "number" && Number.isFinite(data.elevation)) {
      return Math.round(data.elevation);
    }
    return null;
  } catch {
    // Error de red o parsing silencioso
    return null;
  }
}
