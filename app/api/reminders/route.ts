import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateProfileId } from "@/lib/profile";
import type { Reminder } from "@/lib/types";

const PAGE_SIZE_MAX = 50;

export async function GET(req: NextRequest) {
  try {
    const profileId = await getOrCreateProfileId();
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(
      PAGE_SIZE_MAX,
      Math.max(1, parseInt(req.nextUrl.searchParams.get("pageSize") ?? "50", 10))
    );
    const skip = (page - 1) * pageSize;

    const [rows, total] = await Promise.all([
      prisma.reminder.findMany({
        where: { profileId },
        orderBy: { remindAt: "desc" },
        include: { task: { select: { title: true } } },
        skip,
        take: pageSize,
      }),
      prisma.reminder.count({ where: { profileId } }),
    ]);

    const reminders: Reminder[] = rows.map((r) => ({
      id: r.id,
      message: r.message,
      remindAt: r.remindAt.toISOString(),
      sent: r.sent,
      createdAt: r.createdAt.toISOString(),
      taskId: r.taskId ?? undefined,
      taskTitle: r.task?.title ?? undefined,
    }));

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return NextResponse.json({
      reminders,
      page,
      pageSize,
      total,
      totalPages,
    });
  } catch (err) {
    console.error("Reminders GET error:", err);
    return NextResponse.json(
      { error: "Herinneringen laden mislukt" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const profileId = await getOrCreateProfileId();
    const body = (await req.json()) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length === 0) {
      return NextResponse.json({ deletedCount: 0 });
    }

    const { count } = await prisma.reminder.deleteMany({
      where: { id: { in: ids }, profileId },
    });
    return NextResponse.json({ deletedCount: count });
  } catch (err) {
    console.error("Reminders DELETE error:", err);
    return NextResponse.json(
      { error: "Verwijderen mislukt" },
      { status: 500 }
    );
  }
}
