import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkBodySize } from "@/lib/security/body-limit";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getOrCreateProfileId } from "@/lib/profile";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 20;

export async function GET() {
  try {
    const profileId = await getOrCreateProfileId();
    const rows = await prisma.file.findMany({
      where: { profileId },
      orderBy: { uploadedAt: "desc" },
    });
    const files = rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      uploadedAt: r.uploadedAt.toISOString(),
    }));
    return NextResponse.json({ files });
  } catch (err) {
    console.error("Files GET error:", err);
    return NextResponse.json(
      { error: "Bestanden laden mislukt" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const rate = checkRateLimit(req);
    if (!rate.ok) {
      return NextResponse.json({ error: "Te veel requests. Probeer over een minuut opnieuw." }, { status: 429 });
    }
    if (!checkBodySize(req, 10 * 1024 * 1024)) {
      return NextResponse.json({ error: "Request te groot" }, { status: 413 });
    }
    const profileId = await getOrCreateProfileId();
    const count = await prisma.file.count({ where: { profileId } });
    if (count >= MAX_FILES) {
      return NextResponse.json(
        { error: `Maximaal ${MAX_FILES} bestanden toegestaan.` },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Geen bestand ontvangen." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Bestand te groot (max 5 MB)." },
        { status: 400 }
      );
    }

    const mime = file.type || "";
    const name = file.name || "document";
    let extractedText = "";

    if (mime === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
      const buf = Buffer.from(await file.arrayBuffer());
      const pdfParse = (await import("pdf-parse")).default;
      const result = await pdfParse(buf);
      extractedText = result.text ?? "";
    } else if (
      mime === "text/plain" ||
      mime.startsWith("text/") ||
      name.toLowerCase().endsWith(".txt")
    ) {
      extractedText = await file.text();
    } else {
      return NextResponse.json(
        { error: "Alleen PDF en TXT bestanden zijn toegestaan." },
        { status: 400 }
      );
    }

    const row = await prisma.file.create({
      data: {
        filename: name,
        mimeType: mime,
        extractedText: extractedText.slice(0, 100_000),
        profileId,
      },
    });

    return NextResponse.json({
      file: {
        id: row.id,
        filename: row.filename,
        uploadedAt: row.uploadedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("Files POST error:", err);
    return NextResponse.json(
      { error: "Bestand uploaden mislukt" },
      { status: 500 }
    );
  }
}
