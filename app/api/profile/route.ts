import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateProfileId } from "@/lib/profile";
import type { Profile } from "@/lib/types";

export async function GET() {
  try {
    const profileId = await getOrCreateProfileId();
    const row = await prisma.profile.findUnique({
      where: { id: profileId },
    });
    if (!row) {
      return NextResponse.json({ profile: null });
    }
    const profile: Profile = {
      adhdContext: row.adhdContext,
      situatie: row.situatie,
      doelen: row.doelen,
      persoonlijkheid: row.persoonlijkheid ?? undefined,
    };
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("Profile GET error:", err);
    return NextResponse.json(
      { error: "Profiel laden mislukt" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Profile;
    const profileId = await getOrCreateProfileId();
    const data = {
      adhdContext: body.adhdContext ?? "",
      situatie: body.situatie ?? "",
      doelen: body.doelen ?? "",
      persoonlijkheid: body.persoonlijkheid ?? null,
    };
    await prisma.profile.upsert({
      where: { id: profileId },
      create: { id: profileId, ...data },
      update: data,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Profiel opslaan mislukt";
    console.error("Profile POST error:", err);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
