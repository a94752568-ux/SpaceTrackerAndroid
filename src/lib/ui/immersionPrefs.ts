/**
 * Preferencias de inmersión (localStorage). Mute/audio y onboarding.
 */

const KEY = "st.immersion.v1";

export interface ImmersionPrefs {
  /** Audio ambiental y beeps; por defecto false (mute). */
  audioEnabled: boolean;
  /** Onboarding de 20 s ya visto. */
  onboardingDone: boolean;
  /** Haptics en dispositivos que soporten vibrate. */
  hapticsEnabled: boolean;
}

const DEFAULTS: ImmersionPrefs = {
  audioEnabled: false,
  onboardingDone: false,
  hapticsEnabled: true,
};

export function loadImmersionPrefs(): ImmersionPrefs {
  if (typeof localStorage === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<ImmersionPrefs>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveImmersionPrefs(p: ImmersionPrefs): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* quota / private mode */
  }
}

export function patchImmersionPrefs(partial: Partial<ImmersionPrefs>): ImmersionPrefs {
  const next = { ...loadImmersionPrefs(), ...partial };
  saveImmersionPrefs(next);
  return next;
}
