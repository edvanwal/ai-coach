import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateProfileId } from "@/lib/profile";
import { getFinanceProvider, type FinanceProviderId } from "@/lib/finance";

export const runtime = "nodejs";

function parseSince(param: string | null): string {
  if (!param) {
    // standaard: laatste 30 dagen
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }
  const d = new Date(param);
  return Number.isNaN(d.getTime()) ? new Date(Date.now() - 30 * 864e5).toISOString() : d.toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const profileId = await getOrCreateProfileId();
    const body = (await req.json().catch(() => ({}))) as { provider?: FinanceProviderId; sinceISO?: string };
    const providerId: FinanceProviderId = body.provider ?? "mock";
    const provider = getFinanceProvider(providerId);

    const sinceISO = parseSince(body.sinceISO ?? null);

    // Consent status (voor nu: mock is altijd active na eerste sync)
    await prisma.financeConsent.upsert({
      where: { id: `${profileId}:${providerId}` },
      create: {
        id: `${profileId}:${providerId}`,
        profileId,
        provider: providerId,
        status: "active",
      },
      update: { status: "active" },
    });

    const accounts = await provider.fetchAccounts(profileId);
    // Upsert accounts
    const accountIdByExternalId = new Map<string, string>();
    for (const a of accounts) {
      const row = await prisma.financeAccount.upsert({
        where: { provider_externalId: { provider: providerId, externalId: a.externalId } },
        create: {
          profileId,
          provider: providerId,
          externalId: a.externalId,
          name: a.name,
          ibanMasked: a.ibanMasked ?? null,
          currency: a.currency,
          balanceCents: a.balanceCents,
        },
        update: {
          name: a.name,
          ibanMasked: a.ibanMasked ?? null,
          currency: a.currency,
          balanceCents: a.balanceCents,
          profileId, // ownership blijft gelijk, maar zet expliciet
        },
      });
      accountIdByExternalId.set(a.externalId, row.id);
    }

    const txs = await provider.fetchTransactions(profileId, sinceISO);
    let upserted = 0;
    for (const t of txs) {
      const accountId = accountIdByExternalId.get(t.accountExternalId);
      if (!accountId) continue;
      await prisma.financeTransaction.upsert({
        where: { provider_externalId: { provider: providerId, externalId: t.externalId } },
        create: {
          profileId,
          accountId,
          provider: providerId,
          externalId: t.externalId,
          bookedAt: new Date(t.bookedAtISO),
          description: t.description,
          amountCents: t.amountCents,
          currency: t.currency,
          merchant: t.merchant ?? null,
          category: t.category ?? null,
        },
        update: {
          accountId,
          bookedAt: new Date(t.bookedAtISO),
          description: t.description,
          amountCents: t.amountCents,
          currency: t.currency,
          merchant: t.merchant ?? null,
          category: t.category ?? null,
        },
      });
      upserted++;
    }

    return Response.json({
      ok: true,
      provider: providerId,
      accounts: accounts.length,
      transactions: upserted,
      sinceISO,
    });
  } catch (err) {
    console.error("Finance sync error:", err);
    return Response.json({ error: "Finance sync mislukt" }, { status: 500 });
  }
}

