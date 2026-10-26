/**
 * Clima espacial: índice Kp (NOAA SWPC) → data-kp.
 */

export type KpClass = "quiet" | "active" | "storm";

export function kpToClass(kp: number): KpClass {
  if (!Number.isFinite(kp) || kp < 0) return "quiet";
  if (kp >= 5) return "storm";
  if (kp >= 3) return "active";
  return "quiet";
}

export async function fetchLatestKp(fetchImpl: typeof fetch = fetch): Promise<number | null> {
  try {
    const res = await fetchImpl(
      "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json",
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ kp_index?: number; kp?: number }>;
    if (!Array.isArray(data) || data.length === 0) return null;
    const last = data[data.length - 1];
    const kp = Number(last.kp_index ?? last.kp);
    return Number.isFinite(kp) ? kp : null;
  } catch {
    return null;
  }
}

export async function fetchKpClass(fetchImpl: typeof fetch = fetch): Promise<KpClass> {
  const kp = await fetchLatestKp(fetchImpl);
  return kp === null ? "quiet" : kpToClass(kp);
}
