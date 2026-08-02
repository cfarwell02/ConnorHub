import { NextRequest, NextResponse } from "next/server";

import { togglePinned } from "@/lib/file-metadata";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      relativePath?: unknown;
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

    const pinned = await togglePinned(body.relativePath);

    return NextResponse.json({
      pinned,
    });
  } catch (error) {
    console.error("Unable to update pinned state:", error);

    return NextResponse.json(
      { error: "The pinned state could not be updated." },
      { status: 500 },
    );
  }
}
