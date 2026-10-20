/**
 * Utilidad de geocodificación inversa usando OpenStreetMap Nominatim.
 * API: https://nominatim.openstreetmap.org/reverse?format=json&lat=LAT&lon=LON
 */

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
      // Fallback a la primera parte del display_name
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
