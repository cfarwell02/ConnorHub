import path from "node:path";
import { mkdir, realpath, stat } from "node:fs/promises";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONNORHUB_ROOT = process.env.CONNORHUB_ROOT ?? "/srv/connorhub";

type CreateFolderRequestBody = {
  path?: unknown;
  name?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateFolderRequestBody;

    if (typeof body.path !== "string") {
      return NextResponse.json(
        { error: "The destination path is invalid." },
        { status: 400 },
      );
    }

    if (typeof body.name !== "string") {
      return NextResponse.json(
        { error: "A folder name is required." },
        { status: 400 },
      );
    }

    const folderName = sanitizeFolderName(body.name);

    if (!folderName) {
      return NextResponse.json(
        { error: "A valid folder name is required." },
        { status: 400 },
      );
    }

    const destinationDirectory = await resolveDirectory(body.path);

    const newFolderPath = path.join(destinationDirectory, folderName);

    if (!isPathInsideRoot(newFolderPath)) {
      return NextResponse.json(
        { error: "The folder path is outside ConnorHub storage." },
        { status: 403 },
      );
    }

    if (await pathExists(newFolderPath)) {
      return NextResponse.json(
        {
          error: "A file or folder with this name already exists.",
          code: "ITEM_EXISTS",
        },
        { status: 409 },
      );
    }

    await mkdir(newFolderPath);

    const relativePath = path
      .relative(CONNORHUB_ROOT, newFolderPath)
      .split(path.sep)
      .join("/");

    return NextResponse.json(
      {
        success: true,
        folder: {
          name: folderName,
          relativePath,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (hasNodeErrorCode(error, "ENOENT")) {
      return NextResponse.json(
        { error: "The destination folder does not exist." },
        { status: 404 },
      );
    }

    console.error("Unable to create ConnorHub folder:", error);

    return NextResponse.json(
      { error: "The folder could not be created." },
      { status: 500 },
    );
  }
}

async function resolveDirectory(relativeDirectory: string): Promise<string> {
  const normalizedDirectory = normalizeRelativePath(relativeDirectory);

  const resolvedRoot = await realpath(CONNORHUB_ROOT);

  const candidateDirectory = path.resolve(resolvedRoot, normalizedDirectory);

  if (!isPathInsideRoot(candidateDirectory)) {
    throw new Error("The destination is outside ConnorHub storage.");
  }

  const resolvedDirectory = await realpath(candidateDirectory);

  const directoryStats = await stat(resolvedDirectory);

  if (!directoryStats.isDirectory()) {
    throw new Error("The destination is not a directory.");
  }

  return resolvedDirectory;
}

function sanitizeFolderName(value: string): string {
  const trimmedName = value.trim();

  if (trimmedName === "" || trimmedName === "." || trimmedName === "..") {
    return "";
  }

  if (trimmedName.includes("/") || trimmedName.includes("\\")) {
    return "";
  }

  if (/[\u0000-\u001f\u007f]/.test(trimmedName)) {
    return "";
  }

  return trimmedName;
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

function isPathInsideRoot(candidatePath: string): boolean {
  const resolvedRoot = path.resolve(CONNORHUB_ROOT);
  const resolvedCandidate = path.resolve(candidatePath);

  const relativePath = path.relative(resolvedRoot, resolvedCandidate);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (hasNodeErrorCode(error, "ENOENT")) {
      return false;
    }

    throw error;
  }
}

function hasNodeErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}
