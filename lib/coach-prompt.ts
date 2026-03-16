import type { Profile } from "./types";
import type { Task } from "./types";

const FILE_TEXT_LIMIT = 4000;

export interface HealthSummary {
  latestWeight?: number;
  latestWeightDate?: string;
  goals: { kind: string; targetValue: number; unit: string }[];
  insights: { title: string; detail: string }[];
}

/**
 * Bouwt de system prompt voor de AI-coach op basis van profiel, taken, health en geüploade bestanden.
 */
export function buildSystemPrompt(
  profile: Profile | null,
  tasks: Task[],
  fileTexts: { filename: string; text: string }[] = [],
  healthSummary?: HealthSummary | null
): string {
  const base = `Je bent een empathische persoonlijke AI-coach. Je helpt de gebruiker met:
- ADHD-beheer: uitstelgedrag, hyperfocus, structuur, prikkels
- Levensrichting: prioriteiten, doelen, keuzes
- Taken: focus op wat belangrijk is, ook als het niet leuk is

Toon begrip en geen preek. Geef korte, praktische adviezen. Spreek Nederlands.

TAKEN TOEVOEGEN: Als de gebruiker iets noemt dat hij moet doen, kun je dat als taak toevoegen via de tool create_task. Vraag gericht door als iets ontbreekt:
- Wat moet er precies gebeuren? (titel)
- Wanneer moet het klaar? (deadline, YYYY-MM-DD)
- Hoe belangrijk is het? (prioriteit: laag, normaal, hoog)
- Vind je het een vervelende taak waar je tegenop ziet? (isVervelend: ja/nee)
Roep create_task alleen aan als je genoeg informatie hebt; anders stel eerst de ontbrekende vragen.

HERINNERINGEN: Je kunt reminders instellen via set_reminder (message + remindAt in ISO 8601). Reminders kunnen los of gekoppeld aan een taak (taskId). De gebruiker kan zeggen:
- Vaste tijden: "om 18:00", "vanavond 20:00", "morgenochtend om half negen" (= 08:30)
- Relatieve tijden: "over vijf minuten", "over een uur", "over 2 uur"
Reken dit om naar een concreet ISO-tijdstip met de huidige datum/tijd uit het TIJD-blok. Na het toevoegen van een taak kun je vragen: "Wil je een reminder?" De reminder gaat als Pushover-notificatie naar de telefoon.`;

  let context = "";

  const now = new Date();
  const dateStr = now.toLocaleDateString("nl-NL", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  const isoStr = now.toISOString();
  context += `\n\n--- TIJD ---\nHuidige datum en tijd: ${dateStr}, ${timeStr} (${isoStr}). Gebruik dit voor "vandaag", "morgen", "om 18:00" etc.\n`;

  if (profile) {
    context += "\n\n--- CONTEXT GEBRUIKER ---\n";
    if (profile.adhdContext) {
      context += `\nADHD-situatie: ${profile.adhdContext}`;
    }
    if (profile.situatie) {
      context += `\nLevenssituatie: ${profile.situatie}`;
    }
    if (profile.doelen) {
      context += `\nDoelen: ${profile.doelen}`;
    }
    if (profile.persoonlijkheid) {
      context += `\nPersoonlijkheidsprofiel: ${profile.persoonlijkheid}`;
    }
  }

  if (tasks.length > 0) {
    const openTasks = tasks.filter((t) => !t.afgerond);
    const vervelendeTaken = openTasks.filter((t) => t.isVervelend);
    context += "\n\n--- TAKEN ---\n";
    context += openTasks
      .map((t) => {
        let l = `- ${t.title} (prioriteit: ${t.prioriteit})`;
        if (t.deadline) l += `, deadline: ${t.deadline}`;
        if (t.isVervelend) l += " [vervelende taak - gebruiker heeft moeite hier mee]";
        return l;
      })
      .join("\n");
    if (vervelendeTaken.length > 0) {
      context += "\n\nFocus op de vervelende taken: moedig aan om er één per dag te doen.";
    }
  }

  if (healthSummary) {
    const parts: string[] = [];
    if (healthSummary.latestWeight != null && healthSummary.latestWeightDate) {
      const d = new Date(healthSummary.latestWeightDate).toLocaleDateString("nl-NL");
      parts.push(`Laatste gewicht: ${healthSummary.latestWeight} kg (${d})`);
    }
    if (healthSummary.goals?.length) {
      parts.push(`Doelen: ${healthSummary.goals.map((g) => `${g.kind} ${g.targetValue} ${g.unit}`).join(", ")}`);
    }
    if (healthSummary.insights?.length) {
      parts.push(`Inzichten: ${healthSummary.insights.map((i) => `${i.title}: ${i.detail}`).join(" | ")}`);
    }
    if (parts.length) {
      context += "\n\n--- GEZONDHEID (alleen als relevant, geen medische diagnose) ---\n";
      context += parts.join("\n");
      context += "\nReageer rustig en niet-medisch op vragen over gewicht/slaap/beweging.";
    }
  }

  if (fileTexts.length > 0) {
    context += "\n\n--- GEPLAATSTE DOCUMENTEN ---\n";
    for (const { filename, text } of fileTexts) {
      const truncated = text.length > FILE_TEXT_LIMIT ? text.slice(0, FILE_TEXT_LIMIT) + "..." : text;
      if (truncated.trim()) {
        context += `\n[${filename}]\n${truncated}\n`;
      }
    }
  }

  return base + context;
}
