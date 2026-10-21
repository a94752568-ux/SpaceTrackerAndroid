/**
 * Feature Flags para SpaceTracker — Interruptores de características visuales y de UX
 * para permitir despliegues seguros y degradación controlada.
 */

export interface FeatureFlags {
  globeBreathing: boolean;
  strongerGlowPulse: boolean;
  newBottomSheetAnimation: boolean;
  amberContrastFix: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  globeBreathing: true,
  strongerGlowPulse: true,
  newBottomSheetAnimation: true,
  amberContrastFix: true,
};

const STORAGE_KEY = "spacetracker:feature_flags";

export function loadFeatureFlags(): FeatureFlags {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return DEFAULT_FEATURE_FLAGS;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FEATURE_FLAGS;
    const parsed = JSON.parse(raw) as Partial<FeatureFlags>;
    return { ...DEFAULT_FEATURE_FLAGS, ...parsed };
  } catch {
    return DEFAULT_FEATURE_FLAGS;
  }
}

export function saveFeatureFlags(flags: Partial<FeatureFlags>): FeatureFlags {
  const current = loadFeatureFlags();
  const next = { ...current, ...flags };
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}
