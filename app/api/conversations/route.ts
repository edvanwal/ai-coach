import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateProfileId } from "@/lib/profile";

export async function GET() {
  try {
    const profileId = await getOrCreateProfileId();
    const rows = await prisma.conversation.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true },
    });
    const conversations = rows.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt.toISOString(),
    }));
    return NextResponse.json({ conversations });
  } catch (err) {
    console.error("Conversations GET error:", err);
    return NextResponse.json(
      { error: "Gesprekken laden mislukt" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const profileId = await getOrCreateProfileId();
    const conv = await prisma.conversation.create({
      data: {
        profileId,
        title: "Nieuw gesprek",
      },
    });
    return NextResponse.json({
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("Conversations POST error:", err);
    return NextResponse.json(
      { error: "Nieuw gesprek aanmaken mislukt" },
      { status: 500 }
    );
  }
}
