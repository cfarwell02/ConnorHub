import { NextRequest, NextResponse } from "next/server";

import { resolveConnorHubPath } from "@/lib/server-data";
import { createShareToken } from "@/lib/share-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      relativePath?: unknown;
      lifetimeMinutes?: unknown;
    };

    if (
      typeof body.relativePath !== "string" ||
      body.relativePath.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "A file or folder path is required." },
        { status: 400 },
      );
    }

    await resolveConnorHubPath(body.relativePath);

    const lifetimeMinutes =
      typeof body.lifetimeMinutes === "number" &&
      Number.isFinite(body.lifetimeMinutes)
        ? Math.min(Math.max(body.lifetimeMinutes, 1), 60)
        : 5;

    const record = await createShareToken(body.relativePath, lifetimeMinutes);

    const shareOrigin =
      process.env.CONNORHUB_PUBLIC_URL?.replace(/\/$/, "") ||
      getRequestOrigin(request);

    const shareUrl = `${shareOrigin}/share/${encodeURIComponent(record.token)}`;

    return NextResponse.json({
      token: record.token,
      shareUrl,
      expiresAt: record.expiresAt,
    });
  } catch (error) {
    console.error("Unable to create share token:", error);

    return NextResponse.json(
      { error: "A temporary share link could not be created." },
      { status: 500 },
    );
  }

  function getRequestOrigin(request: NextRequest): string {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = forwardedHost ?? request.headers.get("host");

    const forwardedProtocol = request.headers.get("x-forwarded-proto");
    const protocol =
      forwardedProtocol ?? request.nextUrl.protocol.replace(":", "");

    if (!host) {
      return request.nextUrl.origin;
    }

    return `${protocol}://${host}`;
  }
}
