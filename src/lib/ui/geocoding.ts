/**
 * Utilidad de geocodificación inversa usando OpenStreetMap Nominatim.
 * API: https://nominatim.openstreetmap.org/reverse?format=json&lat=LAT&lon=LON
 */

export interface LocationDetails {
  place: string;
  country: string;
  continent: string;
}

export function getApproximateContinent(lat: number, lon: number): string {
  if (lat > 15 && lat < 85 && lon > -170 && lon < -30) return "América del Norte";
  if (lat > -60 && lat < 15 && lon > -90 && lon < -30) return "América del Sur";
  if (lat > 35 && lat < 72 && lon > -10 && lon < 40) return "Europa";
  if (lat > -35 && lat < 38 && lon > -20 && lon < 55) return "África";
  if (lat > 5 && lat < 80 && lon > 40 && lon < 180) return "Asia";
  if (lat > -50 && lat < 10 && lon > 110 && lon < 180) return "Oceanía";
  if (lat < -60) return "Antártida";
  return "Océano / Mar internacional";
}

export async function fetchCityName(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "SpaceTrackerApp/1.0 (educational satellite tracker)",
      },
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const addr = data?.address;
    if (!addr) {
      const parts = typeof data?.display_name === "string" ? data.display_name.split(",") : [];
      return parts[0] ? parts[0].trim() : null;
    }
    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.county ||
      addr.state ||
      (typeof data?.display_name === "string" ? data.display_name.split(",")[0] : null);
    return city ? String(city).trim() : null;
  } catch {
    return null;
  }
}

export async function fetchLocationDetails(lat: number, lon: number): Promise<LocationDetails> {
  let place = "Zona oceánica";
  let country = "Aguas internacionales";
  let continent = getApproximateContinent(lat, lon);
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "SpaceTrackerApp/1.0" },
    });
    if (response.ok) {
      const data = await response.json();
      const addr = data?.address;
      if (addr) {
        place = addr.city || addr.town || addr.village || addr.county || addr.state || addr.region || "Área remota";
        country = addr.country || "Desconocido";
        if (addr.continent) continent = addr.continent;
      }
    }
  } catch {
    // ignore
  }
  return { place, country, continent };
}
