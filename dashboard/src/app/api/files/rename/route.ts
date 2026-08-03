import path from "node:path";
import { realpath, rename, stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import { pushOperation } from "@/lib/history/operation-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONNORHUB_ROOT = process.env.CONNORHUB_ROOT ?? "/srv/connorhub";

type RenameRequestBody = {
  path?: unknown;
  newName?: unknown;
};

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as RenameRequestBody;

    if (typeof body.path !== "string" || body.path.trim() === "") {
      return NextResponse.json(
        { error: "A valid file path is required." },
        { status: 400 },
      );
    }

    if (typeof body.newName !== "string") {
      return NextResponse.json(
        { error: "A new name is required." },
        { status: 400 },
      );
    }

    const newName = sanitizeItemName(body.newName);

    if (!newName) {
      return NextResponse.json(
        { error: "Enter a valid file or folder name." },
        { status: 400 },
      );
    }

    const normalizedPath = normalizeRelativePath(body.path);

    if (!normalizedPath) {
      return NextResponse.json(
        { error: "The ConnorHub root cannot be renamed." },
        { status: 403 },
      );
    }

    const sourcePath = await resolveExistingPath(normalizedPath);
    const parentDirectory = path.dirname(sourcePath);
    const destinationPath = path.join(parentDirectory, newName);

    if (!isPathInsideRoot(destinationPath)) {
      return NextResponse.json(
        { error: "The destination is outside ConnorHub storage." },
        { status: 403 },
      );
    }

    if (sourcePath === destinationPath) {
      return NextResponse.json({
        success: true,
        item: {
          name: newName,
          relativePath: normalizedPath,
        },
      });
    }

    if (await pathExists(destinationPath)) {
      return NextResponse.json(
        {
          error: "A file or folder with this name already exists.",
          code: "ITEM_EXISTS",
        },
        { status: 409 },
      );
    }

    await rename(sourcePath, destinationPath);

    const relativePath = path
      .relative(CONNORHUB_ROOT, destinationPath)
      .split(path.sep)
      .join("/");

    const originalRelativePath = path
      .relative(CONNORHUB_ROOT, sourcePath)
      .split(path.sep)
      .join("/");

    await pushOperation({
      type: "rename",
      fromPath: originalRelativePath,
      toPath: relativePath,
    });

    return NextResponse.json({
      success: true,
      item: {
        name: newName,
        relativePath,
      },
    });
  } catch (error) {
    if (hasNodeErrorCode(error, "ENOENT")) {
      return NextResponse.json(
        { error: "The file or folder no longer exists." },
        { status: 404 },
      );
    }

    console.error("Unable to rename ConnorHub item:", error);

    return NextResponse.json(
      { error: "The item could not be renamed." },
      { status: 500 },
    );
  }
}

async function resolveExistingPath(relativePath: string): Promise<string> {
  const resolvedRoot = await realpath(CONNORHUB_ROOT);
  const candidatePath = path.resolve(resolvedRoot, relativePath);
  const resolvedTarget = await realpath(candidatePath);

  const relativeFromRoot = path.relative(resolvedRoot, resolvedTarget);

  if (
    relativeFromRoot === "" ||
    relativeFromRoot === ".." ||
    relativeFromRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeFromRoot)
  ) {
    throw new Error("The requested item is outside ConnorHub storage.");
  }

  return resolvedTarget;
}

function sanitizeItemName(value: string): string {
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
