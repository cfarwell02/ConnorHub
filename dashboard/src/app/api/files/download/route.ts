import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { resolveConnorHubPath } from "@/lib/server-data";

export async function GET(request: NextRequest) {
  try {
    const relativePath = request.nextUrl.searchParams.get("path");

    if (!relativePath) {
      return NextResponse.json(
        { error: "A file path is required." },
        { status: 400 },
      );
    }

    const absolutePath = await resolveConnorHubPath(relativePath);
    const fileStats = await stat(absolutePath);

    if (fileStats.isDirectory()) {
      return NextResponse.json(
        { error: "Folders cannot be downloaded directly." },
        { status: 400 },
      );
    }

    const contents = await readFile(absolutePath);
    const fileName = path.basename(absolutePath);

    return new NextResponse(contents, {
      headers: {
        "Content-Type": getContentType(fileName),
        "Content-Length": String(fileStats.size),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(
          fileName,
        )}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Unable to download ConnorHub file:", error);

    return NextResponse.json(
      { error: "The file could not be downloaded." },
      { status: 500 },
    );
  }
}

function getContentType(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();

  const contentTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".txt": "text/plain; charset=utf-8",
    ".json": "application/json",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".zip": "application/zip",
  };

  return contentTypes[extension] ?? "application/octet-stream";
}
