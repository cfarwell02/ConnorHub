import path from "node:path";
import { realpath, rm, rmdir, stat } from "node:fs/promises";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONNORHUB_ROOT = process.env.CONNORHUB_ROOT ?? "/srv/connorhub";

type DeleteRequestBody = {
  path?: unknown;
};

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as DeleteRequestBody;

    if (typeof body.path !== "string" || body.path.trim() === "") {
      return NextResponse.json(
        { error: "A valid file path is required." },
        { status: 400 },
      );
    }

    const normalizedPath = normalizeRelativePath(body.path);

    if (!normalizedPath) {
      return NextResponse.json(
        { error: "The ConnorHub root cannot be deleted." },
        { status: 403 },
      );
    }

    const targetPath = await resolveExistingPath(normalizedPath);
    const targetStats = await stat(targetPath);

    if (targetStats.isDirectory()) {
      try {
        await rmdir(targetPath);
      } catch (error) {
        if (hasNodeErrorCode(error, "ENOTEMPTY")) {
          return NextResponse.json(
            {
              error: "This folder is not empty. Delete its contents first.",
              code: "DIRECTORY_NOT_EMPTY",
            },
            { status: 409 },
          );
        }

        throw error;
      }
    } else {
      await rm(targetPath);
    }

    return NextResponse.json({
      success: true,
      deletedPath: normalizedPath,
    });
  } catch (error) {
    if (hasNodeErrorCode(error, "ENOENT")) {
      return NextResponse.json(
        { error: "The file or folder no longer exists." },
        { status: 404 },
      );
    }

    console.error("Unable to delete ConnorHub item:", error);

    return NextResponse.json(
      { error: "The item could not be deleted." },
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

function normalizeRelativePath(value: string): string {
  return value
    .replaceAll("\\", "/")
    .split("/")
    .filter(
      (segment) => segment.length > 0 && segment !== "." && segment !== "..",
    )
    .join(path.sep);
}

function hasNodeErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}
