import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateProfileId } from "@/lib/profile";
import type { Task } from "@/lib/types";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await _req.json()) as Partial<Task>;
    const profileId = await getOrCreateProfileId();
    const row = await prisma.task.updateMany({
      where: { id, profileId },
      data: {
        ...(body.title != null && { title: body.title }),
        ...(body.deadline != null && { deadline: body.deadline }),
        ...(body.prioriteit != null && { prioriteit: body.prioriteit }),
        ...(body.isVervelend != null && { isVervelend: body.isVervelend }),
        ...(body.afgerond != null && { afgerond: body.afgerond }),
      },
    });
    if (row.count === 0) {
      return NextResponse.json({ error: "Taak niet gevonden" }, { status: 404 });
    }
    const updated = await prisma.task.findUnique({ where: { id } });
    const task: Task | null = updated
      ? {
          id: updated.id,
          title: updated.title,
          deadline: updated.deadline ?? undefined,
          prioriteit: updated.prioriteit as Task["prioriteit"],
          isVervelend: updated.isVervelend,
          afgerond: updated.afgerond,
          createdAt: updated.createdAt.toISOString(),
        }
      : null;
    return NextResponse.json({ task });
  } catch (err) {
    console.error("Tasks PATCH error:", err);
    return NextResponse.json(
      { error: "Taak bijwerken mislukt" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const profileId = await getOrCreateProfileId();
    const row = await prisma.task.deleteMany({
      where: { id, profileId },
    });
    if (row.count === 0) {
      return NextResponse.json({ error: "Taak niet gevonden" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Tasks DELETE error:", err);
    return NextResponse.json(
      { error: "Taak verwijderen mislukt" },
      { status: 500 }
    );
  }
}
