import { NextRequest, NextResponse } from "next/server";
import { checkBodySize } from "@/lib/security/body-limit";
import { checkRateLimit } from "@/lib/security/rate-limit";

const MAX_TRANSCRIBE_BODY = 25 * 1024 * 1024; // 25 MB voor audio

export async function POST(req: NextRequest) {
  try {
    const rate = checkRateLimit(req);
    if (!rate.ok) {
      return NextResponse.json({ error: "Te veel requests. Probeer over een minuut opnieuw." }, { status: 429 });
    }
    if (!checkBodySize(req, MAX_TRANSCRIBE_BODY)) {
      return NextResponse.json({ error: "Audio bestand te groot" }, { status: 413 });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is niet geconfigureerd." },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Geen audiobestand ontvangen." },
        { status: 400 }
      );
    }

    const model = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe";
    const openAiForm = new FormData();
    openAiForm.append("file", file);
    openAiForm.append("model", model);
    openAiForm.append("language", "nl");

    const openAiRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: openAiForm,
    });

    const data = await openAiRes.json();
    if (!openAiRes.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "Transcriptie mislukt." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { text: data.text || "" },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "Pragma": "no-cache",
        },
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Onbekende fout";
    return NextResponse.json(
      { error: `Transcriptie fout: ${msg}` },
      { status: 500 }
    );
  }
}
