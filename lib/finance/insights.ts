import type { FinanceOverviewResponse } from "@/lib/types";

export type FinanceInsightKind =
  | "spendSpike"
  | "lowBalance"
  | "upcomingRecurring"
  | "subscriptionCluster"
  | "saveNudge";

export interface FinanceInsight {
  kind: FinanceInsightKind;
  title: string;
  detail: string;
  severity: "info" | "warn" | "high";
}

function euro(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = (abs / 100).toFixed(2).replace(".", ",");
  return `${sign}€ ${euros}`;
}

function isWithinDays(dateISO: string, days: number): boolean {
  const t = new Date(dateISO).getTime();
  const now = Date.now();
  return t >= now - days * 864e5 && t <= now;
}

export function computeFinanceInsights(data: FinanceOverviewResponse): FinanceInsight[] {
  const insights: FinanceInsight[] = [];

  const main = data.accounts[0];
  const totalBalance = data.accounts.reduce((acc, a) => acc + a.balanceCents, 0);
  if (main && main.balanceCents < 75_00) {
    insights.push({
      kind: "lowBalance",
      severity: "high",
      title: "Laag saldo op je betaalrekening",
      detail: `Je betaalrekening staat op ${euro(main.balanceCents)}. Wil je dat ik je help met een korte check: wat komt er nog aan deze week?`,
    });
  } else if (totalBalance < 150_00) {
    insights.push({
      kind: "lowBalance",
      severity: "warn",
      title: "Laag totaal saldo",
      detail: `Je totale saldo is ${euro(totalBalance)}. We kunnen samen je “vaste lasten” en vrije ruimte inschatten.`,
    });
  }

  // Spend spike: laatste 3 dagen vs vorige 7 dagen (heel simpel, read-only MVP)
  const recent3 = data.transactions
    .filter((t) => t.amountCents < 0 && isWithinDays(t.bookedAt, 3))
    .reduce((acc, t) => acc + Math.abs(t.amountCents), 0);
  const recent7 = data.transactions
    .filter((t) => t.amountCents < 0 && isWithinDays(t.bookedAt, 7))
    .reduce((acc, t) => acc + Math.abs(t.amountCents), 0);
  const prev4 = Math.max(1, recent7 - recent3);
  if (recent3 > prev4 * 0.8 && recent3 > 60_00) {
    insights.push({
      kind: "spendSpike",
      severity: "warn",
      title: "De laatste dagen wat meer uitgaven",
      detail: `In de laatste 3 dagen ging er ~${euro(recent3)} uit. Wil je dat ik samen met jou kijk of er iets tussen zit dat je liever had uitgesteld?`,
    });
  }

  // “Subscriptions” cluster: categorie abonnementen of description bevat "abonnement"
  const subs = data.transactions.filter((t) => {
    const desc = (t.description ?? "").toLowerCase();
    const cat = (t.category ?? "").toLowerCase();
    return t.amountCents < 0 && (cat.includes("abonnement") || desc.includes("abonnement"));
  });
  if (subs.length >= 2) {
    const sum = subs.reduce((acc, t) => acc + Math.abs(t.amountCents), 0);
    insights.push({
      kind: "subscriptionCluster",
      severity: "info",
      title: "Abonnementen in beeld",
      detail: `Ik zie ${subs.length} abonnement-uitgaven (totaal ~${euro(sum)}). Wil je 1 lijstje maken met “houden / twijfelen / opzeggen”?`,
    });
  }

  // Save nudge: als er een spaar-transactie is geweest, bevestig (beloning zonder puntjes)
  const saving = data.transactions.find((t) => (t.category ?? "").toLowerCase().includes("spaar"));
  if (saving) {
    insights.push({
      kind: "saveNudge",
      severity: "info",
      title: "Sparen: goed bezig",
      detail: `Je hebt recent iets naar sparen gedaan (${euro(saving.amountCents)}). Kleine stap, groot effect — wil je dat ik dit een “vaste routine” maak?`,
    });
  }

  return insights;
}

