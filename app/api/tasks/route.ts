import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateProfileId } from "@/lib/profile";
import type { Task } from "@/lib/types";

export async function GET() {
  try {
    const profileId = await getOrCreateProfileId();
    const rows = await prisma.task.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
    });
    const tasks: Task[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      deadline: r.deadline ?? undefined,
      prioriteit: r.prioriteit as Task["prioriteit"],
      isVervelend: r.isVervelend,
      afgerond: r.afgerond,
      createdAt: r.createdAt.toISOString(),
    }));
    return NextResponse.json({ tasks });
  } catch (err) {
    console.error("Tasks GET error:", err);
    return NextResponse.json(
      { error: "Taken laden mislukt" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Omit<Task, "id" | "createdAt">;
    const profileId = await getOrCreateProfileId();
    const row = await prisma.task.create({
      data: {
        title: body.title,
        deadline: body.deadline ?? null,
        prioriteit: body.prioriteit ?? "normaal",
        isVervelend: body.isVervelend ?? false,
        afgerond: body.afgerond ?? false,
        profileId,
      },
    });
    const task: Task = {
      id: row.id,
      title: row.title,
      deadline: row.deadline ?? undefined,
      prioriteit: row.prioriteit as Task["prioriteit"],
      isVervelend: row.isVervelend,
      afgerond: row.afgerond,
      createdAt: row.createdAt.toISOString(),
    };
    return NextResponse.json({ task });
  } catch (err) {
    console.error("Tasks POST error:", err);
    return NextResponse.json(
      { error: "Taak toevoegen mislukt" },
      { status: 500 }
    );
  }
}
