import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateProfileId } from "@/lib/profile";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const profileId = await getOrCreateProfileId();
    await prisma.conversation.deleteMany({
      where: { id, profileId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Conversation DELETE error:", err);
    return NextResponse.json(
      { error: "Gesprek verwijderen mislukt" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { title?: string };
    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json(
        { error: "title is vereist" },
        { status: 400 }
      );
    }
    const profileId = await getOrCreateProfileId();
    const conv = await prisma.conversation.updateMany({
      where: { id, profileId },
      data: { title },
    });
    if (conv.count === 0) {
      return NextResponse.json({ error: "Gesprek niet gevonden" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, title });
  } catch (err) {
    console.error("Conversation PATCH error:", err);
    return NextResponse.json(
      { error: "Titel wijzigen mislukt" },
      { status: 500 }
    );
  }
}
