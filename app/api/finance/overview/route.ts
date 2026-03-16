import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateProfileId } from "@/lib/profile";
import type { FinanceOverviewResponse } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const profileId = await getOrCreateProfileId();
    const provider = req.nextUrl.searchParams.get("provider") ?? "mock";

    const accounts = await prisma.financeAccount.findMany({
      where: { profileId, provider },
      orderBy: { name: "asc" },
    });
    const txs = await prisma.financeTransaction.findMany({
      where: { profileId, provider },
      orderBy: { bookedAt: "desc" },
      take: 200,
    });

    const out: FinanceOverviewResponse = {
      provider,
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        ibanMasked: a.ibanMasked ?? undefined,
        currency: a.currency,
        balanceCents: a.balanceCents,
        updatedAt: a.updatedAt.toISOString(),
      })),
      transactions: txs.map((t) => ({
        id: t.id,
        accountId: t.accountId,
        bookedAt: t.bookedAt.toISOString(),
        description: t.description,
        amountCents: t.amountCents,
        currency: t.currency,
        merchant: t.merchant ?? undefined,
        category: t.category ?? undefined,
        isRecurring: t.isRecurring,
      })),
    };

    return Response.json(out);
  } catch (err) {
    console.error("Finance overview error:", err);
    return Response.json({ error: "Finance laden mislukt" }, { status: 500 });
  }
}

