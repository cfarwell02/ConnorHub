import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

import { getShareToken } from "@/lib/share-tokens";
import { resolveConnorHubPath } from "@/lib/server-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShareRouteProps = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(request: Request, { params }: ShareRouteProps) {
  try {
    const { token } = await params;
    const record = await getShareToken(token);

    if (!record) {
      return NextResponse.json(
        { error: "This share has expired or does not exist." },
        { status: 404 },
      );
    }

    const absolutePath = await resolveConnorHubPath(record.relativePath);
    const itemStats = await stat(absolutePath);

    if (!itemStats.isDirectory()) {
      return createFileStreamResponse(
        absolutePath,
        path.basename(absolutePath),
        itemStats.size,
      );
    }

    return createFolderZipStreamResponse(
      request,
      absolutePath,
      `${path.basename(absolutePath)}.zip`,
    );
  } catch (error) {
    console.error("Unable to serve shared ConnorHub item:", error);

    return NextResponse.json(
      { error: "The shared item could not be downloaded." },
      { status: 500 },
    );
  }
}

function createFileStreamResponse(
  absolutePath: string,
  fileName: string,
  sizeBytes: number,
): Response {
  const nodeStream = createReadStream(absolutePath);

  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": getContentType(fileName),
      "Content-Length": String(sizeBytes),
      "Content-Disposition": createContentDisposition(fileName),
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function createFolderZipStreamResponse(
  request: Request,
  absolutePath: string,
  zipName: string,
): Response {
  const parentDirectory = path.dirname(absolutePath);
  const folderName = path.basename(absolutePath);

  const zipProcess = spawn("zip", ["-r", "-q", "-", folderName], {
    cwd: parentDirectory,
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (!zipProcess.stdout) {
    zipProcess.kill();
    throw new Error("The ZIP output stream could not be created.");
  }

  let stderr = "";

  zipProcess.stderr?.setEncoding("utf8");
  zipProcess.stderr?.on("data", (chunk: string) => {
    stderr += chunk;
  });

  zipProcess.once("error", (error) => {
    console.error("Unable to start ZIP process:", error);
  });

  zipProcess.once("close", (code) => {
    if (code !== 0) {
      console.error(
        `ZIP process exited with code ${code ?? "unknown"}: ${stderr}`,
      );
    }
  });

  request.signal.addEventListener(
    "abort",
    () => {
      if (!zipProcess.killed) {
        zipProcess.kill("SIGTERM");
      }
    },
    { once: true },
  );

  const webStream = Readable.toWeb(
    zipProcess.stdout,
  ) as ReadableStream<Uint8Array>;

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": createContentDisposition(zipName),
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function createContentDisposition(fileName: string): string {
  const safeName = fileName.replaceAll('"', "");
  const encodedName = encodeURIComponent(fileName);

  return `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`;
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
    ".zip": "application/zip",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
  };

  return contentTypes[extension] ?? "application/octet-stream";
}
