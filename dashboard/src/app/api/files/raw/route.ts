import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

import { resolveConnorHubPath } from "@/lib/server-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
        { error: "Folders cannot be previewed." },
        { status: 400 },
      );
    }

    const fileName = path.basename(absolutePath);
    const nodeStream = createReadStream(absolutePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    return new Response(webStream, {
      headers: {
        "Content-Type": getContentType(fileName),
        "Content-Length": String(fileStats.size),
        "Content-Disposition": `inline; filename="${fileName.replaceAll(
          '"',
          "",
        )}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Unable to preview ConnorHub file:", error);

    return NextResponse.json(
      { error: "The file could not be previewed." },
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
    ".md": "text/markdown; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".jsx": "text/javascript; charset=utf-8",
    ".ts": "text/plain; charset=utf-8",
    ".tsx": "text/plain; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
  };

  return contentTypes[extension] ?? "application/octet-stream";
}
