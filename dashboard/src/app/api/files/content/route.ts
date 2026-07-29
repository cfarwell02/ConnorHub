import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { getMimeType } from "@/lib/file-types";
import { resolveConnorHubPath } from "@/lib/server-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestedPath = request.nextUrl.searchParams.get("path");

  if (!requestedPath) {
    return NextResponse.json(
      {
        error: "A file path is required.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const absolutePath = await resolveConnorHubPath(requestedPath);
    const fileStats = await stat(absolutePath);

    if (!fileStats.isFile()) {
      return NextResponse.json(
        {
          error: "The requested path is not a file.",
        },
        {
          status: 400,
        },
      );
    }

    const fileName = path.basename(absolutePath);
    const contentType = getMimeType(fileName);
    const nodeStream = createReadStream(absolutePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new Response(webStream, {
      headers: {
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
        "Content-Disposition": createContentDisposition(fileName),
        "Content-Length": fileStats.size.toString(),
        "Content-Type": contentType,
        "Last-Modified": fileStats.mtime.toUTCString(),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Unable to stream ConnorHub file:", error);

    return NextResponse.json(
      {
        error: "The requested file could not be opened.",
      },
      {
        status: 404,
      },
    );
  }
}

function createContentDisposition(fileName: string): string {
  const safeFallbackName = fileName
    .replace(/[^\x20-\x7E]/g, "_")
    .replaceAll('"', '\\"');

  return `inline; filename="${safeFallbackName}"; filename*=UTF-8''${encodeURIComponent(
    fileName,
  )}`;
}
