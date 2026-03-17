import { NextResponse } from "next/server";
import { getRun } from "@/lib/mobile-control/store";
import { noStoreHeaders } from "@/lib/mobile-control/security";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) {
    return NextResponse.json(
      { ok: false, error: "Run niet gevonden" },
      { status: 404, headers: noStoreHeaders() }
    );
  }
  return NextResponse.json({ ok: true, run }, { headers: noStoreHeaders() });
}

