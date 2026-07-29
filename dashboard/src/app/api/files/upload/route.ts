import path from "node:path";
import { mkdir, realpath, stat, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONNORHUB_ROOT = process.env.CONNORHUB_ROOT ?? "/srv/connorhub";

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const uploadedFile = formData.get("file");
    const requestedDirectory = formData.get("path");

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json(
        { error: "No file was provided." },
        { status: 400 },
      );
    }

    if (requestedDirectory !== null && typeof requestedDirectory !== "string") {
      return NextResponse.json(
        { error: "The destination path is invalid." },
        { status: 400 },
      );
    }

    if (uploadedFile.size === 0) {
      return NextResponse.json(
        { error: "The uploaded file is empty." },
        { status: 400 },
      );
    }

    if (uploadedFile.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: "The uploaded file exceeds the 100 MB limit.",
        },
        { status: 413 },
      );
    }

    const safeFileName = sanitizeFileName(uploadedFile.name);

    if (!safeFileName) {
      return NextResponse.json(
        { error: "The uploaded filename is invalid." },
        { status: 400 },
      );
    }

    const destinationDirectory = await resolveUploadDirectory(
      requestedDirectory ?? "",
    );

    const destinationFilePath = path.join(destinationDirectory, safeFileName);

    if (!isPathInsideRoot(destinationFilePath)) {
      return NextResponse.json(
        { error: "The destination path is outside ConnorHub storage." },
        { status: 403 },
      );
    }

    if (await pathExists(destinationFilePath)) {
      return NextResponse.json(
        {
          error: "A file with this name already exists.",
          code: "FILE_EXISTS",
        },
        { status: 409 },
      );
    }

    const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());

    await writeFile(destinationFilePath, fileBuffer, {
      flag: "wx",
    });

    const relativePath = path
      .relative(CONNORHUB_ROOT, destinationFilePath)
      .split(path.sep)
      .join("/");

    return NextResponse.json(
      {
        success: true,
        file: {
          name: safeFileName,
          relativePath,
          sizeBytes: uploadedFile.size,
          mimeType: uploadedFile.type || "application/octet-stream",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unable to upload ConnorHub file:", error);

    return NextResponse.json(
      { error: "The file could not be uploaded." },
      { status: 500 },
    );
  }
}

async function resolveUploadDirectory(
  relativeDirectory: string,
): Promise<string> {
  const normalizedDirectory = normalizeRelativePath(relativeDirectory);

  const candidateDirectory = path.resolve(CONNORHUB_ROOT, normalizedDirectory);

  if (!isPathInsideRoot(candidateDirectory)) {
    throw new Error("Destination path is outside ConnorHub storage.");
  }

  await mkdir(candidateDirectory, {
    recursive: true,
  });

  const resolvedRoot = await realpath(CONNORHUB_ROOT);
  const resolvedDirectory = await realpath(candidateDirectory);

  const relativeFromRoot = path.relative(resolvedRoot, resolvedDirectory);

  if (
    relativeFromRoot === ".." ||
    relativeFromRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeFromRoot)
  ) {
    throw new Error("Destination path escapes ConnorHub storage.");
  }

  const directoryStats = await stat(resolvedDirectory);

  if (!directoryStats.isDirectory()) {
    throw new Error("The destination is not a directory.");
  }

  return resolvedDirectory;
}

function normalizeRelativePath(value: string): string {
  return value
    .replaceAll("\\", "/")
    .split("/")
    .filter(
      (segment) => segment.length > 0 && segment !== "." && segment !== "..",
    )
    .join(path.sep);
}

function sanitizeFileName(value: string): string {
  const baseName = path.basename(value.replaceAll("\\", "/"));

  return baseName.replace(/[\u0000-\u001f\u007f]/g, "").trim();
}

function isPathInsideRoot(candidatePath: string): boolean {
  const resolvedRoot = path.resolve(CONNORHUB_ROOT);
  const resolvedCandidate = path.resolve(candidatePath);

  const relativePath = path.relative(resolvedRoot, resolvedCandidate);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}
