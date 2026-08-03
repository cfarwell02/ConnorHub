import { NextRequest, NextResponse } from "next/server";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import { getShareToken } from "@/lib/share-tokens";
import { resolveConnorHubPath } from "@/lib/server-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShareRouteProps = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(request: NextRequest, { params }: ShareRouteProps) {
  let temporaryDirectory: string | null = null;

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
      const contents = await readFile(absolutePath);
      const fileName = path.basename(absolutePath);

      return new NextResponse(contents, {
        headers: {
          "Content-Type": getContentType(fileName),
          "Content-Length": String(itemStats.size),
          "Content-Disposition": createContentDisposition(fileName),
          "Cache-Control": "private, no-store",
        },
      });
    }

    temporaryDirectory = await mkdtemp(
      path.join(os.tmpdir(), "connorhub-share-token-"),
    );

    const folderName = path.basename(absolutePath);
    const zipName = `${folderName}.zip`;
    const zipPath = path.join(temporaryDirectory, zipName);

    await createZipArchive({
      sourceDirectory: path.dirname(absolutePath),
      folderName,
      outputPath: zipPath,
    });

    const zipStats = await stat(zipPath);
    const zipContents = await readFile(zipPath);

    return new NextResponse(zipContents, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(zipStats.size),
        "Content-Disposition": createContentDisposition(zipName),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Unable to serve shared ConnorHub item:", error);

    return NextResponse.json(
      { error: "The shared item could not be downloaded." },
      { status: 500 },
    );
  } finally {
    if (temporaryDirectory) {
      await rm(temporaryDirectory, {
        recursive: true,
        force: true,
      }).catch((error) => {
        console.error("Unable to clean shared ZIP:", error);
      });
    }
  }
}

function createZipArchive({
  sourceDirectory,
  folderName,
  outputPath,
}: {
  sourceDirectory: string;
  folderName: string;
  outputPath: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("zip", ["-r", "-q", outputPath, folderName], {
      cwd: sourceDirectory,
    });

    child.once("error", reject);

    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`zip exited with code ${code ?? "unknown"}.`));
    });
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
