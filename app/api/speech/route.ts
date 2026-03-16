import { NextRequest, NextResponse } from "next/server";
import { checkBodySize } from "@/lib/security/body-limit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { generateSpeech } from "@/lib/tts-provider";

export async function POST(req: NextRequest) {
  try {
    const rate = checkRateLimit(req);
    if (!rate.ok) {
      return NextResponse.json({ error: "Te veel requests. Probeer over een minuut opnieuw." }, { status: 429 });
    }
    if (!checkBodySize(req, 64 * 1024)) {
      return NextResponse.json({ error: "Request te groot" }, { status: 413 });
    }
    const provider = (process.env.TTS_PROVIDER || "openai").toLowerCase();
    const needsOpenAI = provider === "openai" && !process.env.OPENAI_API_KEY;
    const needsEleven = provider === "elevenlabs" && (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID);
    if (needsOpenAI) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is niet geconfigureerd." },
        { status: 500 }
      );
    }
    if (needsEleven) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY en ELEVENLABS_VOICE_ID zijn vereist voor ElevenLabs." },
        { status: 500 }
      );
    }

    const { text } = (await req.json()) as { text?: string };
    const input = text?.trim();
    if (!input) {
      return NextResponse.json(
        { error: "Geen tekst ontvangen voor spraak." },
        { status: 400 }
      );
    }

    const audioBuffer = await generateSpeech(input);
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Onbekende fout";
    console.error("Speech API error:", err);
    return NextResponse.json(
      { error: `Spraak fout: ${msg}` },
      { status: 500 }
    );
  }
}
