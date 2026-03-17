import React from "react";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

function clampSize(n: number): number {
  if (!Number.isFinite(n)) return 192;
  return Math.max(64, Math.min(1024, Math.round(n)));
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  const px = clampSize(parseInt(size ?? "192", 10));

  const url = new URL(req.url);
  const isMaskable = url.searchParams.get("maskable") === "1";

  const pad = isMaskable ? Math.round(px * 0.14) : Math.round(px * 0.08);
  const fontSize = Math.round(px * 0.26);
  const subFont = Math.round(px * 0.11);

  return new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          width: px,
          height: px,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f1419",
        },
      },
      React.createElement(
        "div",
        {
          style: {
            width: px - pad * 2,
            height: px - pad * 2,
            borderRadius: Math.round(px * 0.22),
            background: "linear-gradient(135deg, rgba(88,166,255,0.25), rgba(26,35,50,0.9))",
            border: "1px solid rgba(88,166,255,0.35)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: Math.round(px * 0.08),
            boxSizing: "border-box",
            color: "#e6edf3",
          },
        },
        React.createElement(
          "div",
          {
            style: {
              fontSize,
              fontWeight: 800,
              letterSpacing: -1,
              lineHeight: 1,
            },
          },
          "AI"
        ),
        React.createElement(
          "div",
          {
            style: {
              fontSize: subFont,
              opacity: 0.85,
              marginTop: Math.round(px * 0.04),
            },
          },
          "Coach"
        )
      )
    ),
    { width: px, height: px }
  );
}

