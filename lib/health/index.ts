/**
 * Health data sources: manual first, later Apple Health / Google Fit / smart scales.
 * Nu gebruikt de app alleen handmatige invoer via POST /api/health/entry.
 * Toekomst: HealthSource.importEntries(profileId, since) voor externe bronnen.
 */
export interface HealthSource {
  id: string;
  displayName: string;
  importEntries(profileId: string, since: Date): Promise<
    Array<{
      date: Date;
      weightKg?: number;
      fatPct?: number;
      sleepHours?: number;
      activityMinutes?: number;
    }>
  >;
}

export { computeHealthInsights } from "./insights";
export type { HealthInsight, HealthInsightKind } from "./insights";
