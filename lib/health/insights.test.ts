import { describe, it, expect } from "vitest";
import { computeHealthInsights } from "./insights";
import type { HealthOverviewResponse } from "@/lib/types";

function makeEntry(
  overrides: Partial<HealthOverviewResponse["entries"][0]> = {}
): HealthOverviewResponse["entries"][0] {
  return {
    id: "1",
    date: "2025-01-01",
    source: "manual",
    createdAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("computeHealthInsights", () => {
  it("geeft lege array bij weinig data", () => {
    const data: HealthOverviewResponse = {
      entries: [makeEntry({ weightKg: 72 }), makeEntry({ weightKg: 71 })],
      goals: [],
    };
    expect(computeHealthInsights(data)).toEqual([]);
  });

  it("geeft weight_trend_down bij dalend gewicht", () => {
    const entries = [];
    const base = new Date("2025-01-01");
    for (let i = 0; i < 10; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      entries.push(makeEntry({
        id: `e${i}`,
        date: d.toISOString().slice(0, 10),
        weightKg: 74 - i * 0.5,
      }));
    }
    const data: HealthOverviewResponse = {
      entries: entries.reverse(),
      goals: [],
    };
    const out = computeHealthInsights(data);
    expect(out.some((i) => i.kind === "weight_trend_down")).toBe(true);
  });

  it("geeft weight_trend_up bij stijgend gewicht", () => {
    const entries = [];
    const base = new Date("2025-01-01");
    for (let i = 0; i < 10; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      entries.push(makeEntry({
        id: `e${i}`,
        date: d.toISOString().slice(0, 10),
        weightKg: 70 + i * 0.4,
      }));
    }
    const data: HealthOverviewResponse = {
      entries: entries.reverse(),
      goals: [],
    };
    const out = computeHealthInsights(data);
    expect(out.some((i) => i.kind === "weight_trend_up")).toBe(true);
  });

  it("geeft weight_volatile bij schommelend gewicht", () => {
    const entries = [];
    const base = new Date("2025-01-01");
    const weights = [72, 74, 71, 75, 72, 74, 71];
    for (let i = 0; i < weights.length; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      entries.push(makeEntry({
        id: `e${i}`,
        date: d.toISOString().slice(0, 10),
        weightKg: weights[i],
      }));
    }
    const data: HealthOverviewResponse = {
      entries: entries.reverse(),
      goals: [],
    };
    const out = computeHealthInsights(data);
    expect(out.some((i) => i.kind === "weight_volatile")).toBe(true);
  });

  it("geeft sleep_low bij weinig slaap", () => {
    const entries = [];
    const base = new Date("2025-01-01");
    for (let i = 0; i < 5; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      entries.push(makeEntry({
        id: `e${i}`,
        date: d.toISOString().slice(0, 10),
        sleepHours: 5,
        weightKg: 72,
      }));
    }
    const data: HealthOverviewResponse = {
      entries,
      goals: [],
    };
    const out = computeHealthInsights(data);
    expect(out.some((i) => i.kind === "sleep_low")).toBe(true);
  });

  it("geeft sleep_ok bij voldoende slaap", () => {
    const entries = [];
    const base = new Date("2025-01-01");
    for (let i = 0; i < 5; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      entries.push(makeEntry({
        id: `e${i}`,
        date: d.toISOString().slice(0, 10),
        sleepHours: 7.5,
        weightKg: 72,
      }));
    }
    const data: HealthOverviewResponse = {
      entries,
      goals: [],
    };
    const out = computeHealthInsights(data);
    expect(out.some((i) => i.kind === "sleep_ok")).toBe(true);
  });

  it("geeft activity_low bij weinig beweging", () => {
    const entries = [
      makeEntry({ id: "1", date: "2025-01-01", activityMinutes: 10, weightKg: 72 }),
      makeEntry({ id: "2", date: "2025-01-02", activityMinutes: 5, weightKg: 72 }),
    ];
    const data: HealthOverviewResponse = { entries, goals: [] };
    const out = computeHealthInsights(data);
    expect(out.some((i) => i.kind === "activity_low")).toBe(true);
  });
});
