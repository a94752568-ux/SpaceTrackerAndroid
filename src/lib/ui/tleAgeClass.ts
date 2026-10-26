/**
 * Clase CSS por frescura de TLE (diagnóstico de época).
 */
import { diagnoseTleEpoch, type TleEpochDiagnosis } from "../space/tle-epoch";
import type { EpochStatus } from "../space/types";

export type TleAgeClass = "st-tle-fresh" | "st-tle-aging" | "st-tle-stale" | "st-tle-unknown";

export function epochStatusToClass(status: EpochStatus | string | undefined): TleAgeClass {
  switch (status) {
    case "fresh":
      return "st-tle-fresh";
    case "aging":
      return "st-tle-aging";
    case "stale":
      return "st-tle-stale";
    default:
      return "st-tle-unknown";
  }
}

export function tleAgeClassFromLine1(line1: string, now: Date = new Date()): TleAgeClass {
  try {
    const d: TleEpochDiagnosis = diagnoseTleEpoch(line1, now);
    return epochStatusToClass(d.status);
  } catch {
    return "st-tle-unknown";
  }
}
