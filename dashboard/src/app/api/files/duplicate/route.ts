import { NextRequest, NextResponse } from "next/server";
import { copyFile, cp, stat } from "node:fs/promises";
import path from "node:path";

import { CONNORHUB_ROOT, resolveConnorHubPath } from "@/lib/server-data";

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

    const sourcePath = sanitizeRelativePath(body.relativePath);
    const sourceAbsolutePath = await resolveConnorHubPath(sourcePath);
    const sourceStats = await stat(sourceAbsolutePath);

    const parentDirectory = path.dirname(sourceAbsolutePath);
    const originalName = path.basename(sourceAbsolutePath);
    const duplicateName = await createAvailableCopyName(
      parentDirectory,
      originalName,
      sourceStats.isDirectory(),
    );

    const duplicateAbsolutePath = path.join(parentDirectory, duplicateName);

    if (sourceStats.isDirectory()) {
      await cp(sourceAbsolutePath, duplicateAbsolutePath, {
        recursive: true,
        errorOnExist: true,
      });
    } else {
      await copyFile(sourceAbsolutePath, duplicateAbsolutePath);
    }

    return NextResponse.json({
      success: true,
      relativePath: path
        .relative(CONNORHUB_ROOT, duplicateAbsolutePath)
        .split(path.sep)
        .join("/"),
    });
  } catch (error) {
    console.error("Unable to duplicate ConnorHub item:", error);

    return NextResponse.json(
      { error: "The item could not be duplicated." },
      { status: 500 },
    );
  }
}

async function createAvailableCopyName(
  parentDirectory: string,
  originalName: string,
  isDirectory: boolean,
): Promise<string> {
  const extension = isDirectory ? "" : path.extname(originalName);
  const baseName = isDirectory
    ? originalName
    : path.basename(originalName, extension);

  let copyNumber = 1;

  while (true) {
    const suffix = copyNumber === 1 ? " copy" : ` copy ${copyNumber}`;
    const candidateName = `${baseName}${suffix}${extension}`;
    const candidatePath = path.join(parentDirectory, candidateName);

    try {
      await stat(candidatePath);
      copyNumber += 1;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return candidateName;
      }

      throw error;
    }
  }
}

function sanitizeRelativePath(value: string): string {
  return value
    .replaceAll("\\", "/")
    .split("/")
    .filter(
      (segment) => segment.length > 0 && segment !== "." && segment !== "..",
    )
    .join("/");
}
