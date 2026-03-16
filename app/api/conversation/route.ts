import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateProfileId } from "@/lib/profile";
import type { ChatMessage } from "@/lib/types";

const LIMIT = 50;

export async function GET(req: NextRequest) {
  try {
    const profileId = await getOrCreateProfileId();
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is vereist" },
        { status: 400 }
      );
    }

    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, profileId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: LIMIT,
        },
      },
    });

    if (!conv) {
      return NextResponse.json(
        { error: "Gesprek niet gevonden" },
        { status: 404 }
      );
    }

    const messages: ChatMessage[] = conv.messages.map((r) => ({
      role: r.role as "user" | "assistant",
      content: r.content,
    }));

    return NextResponse.json({
      conversationId: conv.id,
      title: conv.title,
      messages,
    });
  } catch (err) {
    console.error("Conversation GET error:", err);
    return NextResponse.json(
      { error: "Gesprek laden mislukt" },
      { status: 500 }
    );
  }
}
