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
    const result = await prisma.file.deleteMany({
      where: { id, profileId },
    });
    if (result.count === 0) {
      return NextResponse.json(
        { error: "Bestand niet gevonden" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Files DELETE error:", err);
    return NextResponse.json(
      { error: "Bestand verwijderen mislukt" },
      { status: 500 }
    );
  }
}
