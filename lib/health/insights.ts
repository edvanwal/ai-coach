import type { HealthOverviewResponse } from "@/lib/types";

export type HealthInsightKind =
  | "weight_trend_down"
  | "weight_trend_up"
  | "weight_volatile"
  | "sleep_low"
  | "sleep_ok"
  | "activity_low";

export interface HealthInsight {
  kind: HealthInsightKind;
  title: string;
  detail: string;
  severity: "info" | "warn" | "high";
}

function daysDiff(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 864e5);
}

export function computeHealthInsights(data: HealthOverviewResponse): HealthInsight[] {
  const insights: HealthInsight[] = [];
  const entries = data.entries ?? [];

  const withWeight = entries.filter((e) => e.weightKg != null).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  if (withWeight.length >= 3) {
    const recent = withWeight.slice(0, 7);
    const older = withWeight.slice(7, 14);
    const avgRecent = recent.reduce((s, e) => s + (e.weightKg ?? 0), 0) / recent.length;
    const avgOlder = older.length > 0
      ? older.reduce((s, e) => s + (e.weightKg ?? 0), 0) / older.length
      : avgRecent;
    const diff = avgRecent - avgOlder;
    const volatility = Math.max(...recent.map((e) => e.weightKg ?? 0)) - Math.min(...recent.map((e) => e.weightKg ?? 0));

    if (volatility > 2 && Math.abs(diff) < 0.5) {
      insights.push({
        kind: "weight_volatile",
        severity: "warn",
        title: "Gewicht schommelt wat",
        detail: `In de laatste week varieert je gewicht ~${volatility.toFixed(1)} kg. Dat kan komen door vocht of timing. Log je gewicht steeds op hetzelfde moment (bijv. 's ochtends) voor een helderder beeld.`,
      });
    } else if (diff < -0.3) {
      insights.push({
        kind: "weight_trend_down",
        severity: "info",
        title: "Gewicht daalt licht",
        detail: `Gemiddeld ~${Math.abs(diff).toFixed(1)} kg lager dan de periode ervoor. De coach kan hier rustig op reageren als je erover praat.`,
      });
    } else if (diff > 0.3) {
      insights.push({
        kind: "weight_trend_up",
        severity: "info",
        title: "Gewicht stijgt licht",
        detail: `Gemiddeld ~${diff.toFixed(1)} kg hoger dan de periode ervoor. Geen oordeel – we kunnen samen kijken of er patronen zijn (slaap, stress, voeding).`,
      });
    }
  }

  const withSleep = entries.filter((e) => e.sleepHours != null && e.sleepHours > 0);
  if (withSleep.length >= 3) {
    const avgSleep = withSleep.reduce((s, e) => s + (e.sleepHours ?? 0), 0) / withSleep.length;
    if (avgSleep < 6) {
      insights.push({
        kind: "sleep_low",
        severity: "warn",
        title: "Weinig slaap gemiddeld",
        detail: `Je logt gemiddeld ${avgSleep.toFixed(1)} uur slaap. Slaap heeft invloed op focus en gewicht. Wil je daar eens over praten met de coach?`,
      });
    } else if (avgSleep >= 7) {
      insights.push({
        kind: "sleep_ok",
        severity: "info",
        title: "Goed slaapritme",
        detail: `Gemiddeld ${avgSleep.toFixed(1)} uur – dat draagt bij aan je energie en focus.`,
      });
    }
  }

  const withActivity = entries.filter((e) => e.activityMinutes != null && e.activityMinutes > 0);
  if (withActivity.length >= 2) {
    const totalMinutes = withActivity.reduce((s, e) => s + (e.activityMinutes ?? 0), 0);
    const daysSpan = withActivity.length;
    const perWeek = (totalMinutes / daysSpan) * 7;
    if (perWeek < 90) {
      insights.push({
        kind: "activity_low",
        severity: "info",
        title: "Kleine beetjes beweging helpen",
        detail: `Je logt ~${Math.round(perWeek)} min beweging per week. Zelfs 10 min per dag wandelen helpt. De coach kan je helpen een haalbaar patroon te vinden.`,
      });
    }
  }

  return insights;
}
