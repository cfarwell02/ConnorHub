import { NextRequest, NextResponse } from "next/server";
import { mkdir, rename } from "node:fs/promises";
import path from "node:path";

import { CONNORHUB_ROOT, resolveConnorHubPath } from "@/lib/server-data";
import {
  readTrashRecords,
  writeTrashRecords,
  type TrashRecord,
} from "@/lib/trash";
import { pushOperation } from "@/lib/history/operation-history";

const TRASH_DIRECTORY = path.join(CONNORHUB_ROOT, ".connorhub", "trash");

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      relativePaths?: unknown;
    };

    if (!Array.isArray(body.relativePaths)) {
      return NextResponse.json(
        { error: "Selected paths are required." },
        { status: 400 },
      );
    }

    const relativePaths = removeNestedSelections(
      body.relativePaths
        .filter((value): value is string => typeof value === "string")
        .map(sanitizeRelativePath)
        .filter(Boolean),
    );

    if (relativePaths.length === 0) {
      return NextResponse.json(
        { error: "At least one item must be selected." },
        { status: 400 },
      );
    }

    await mkdir(TRASH_DIRECTORY, {
      recursive: true,
    });

    const existingRecords = await readTrashRecords();
    const newRecords: TrashRecord[] = [];

    for (const relativePath of relativePaths) {
      if (
        relativePath === ".connorhub" ||
        relativePath.startsWith(".connorhub/")
      ) {
        throw new Error("ConnorHub system files cannot be moved to Trash.");
      }

      const sourceAbsolutePath = await resolveConnorHubPath(relativePath);

      const id = crypto.randomUUID();
      const originalName = path.basename(sourceAbsolutePath);
      const trashName = `${id}-${originalName}`;
      const trashAbsolutePath = path.join(TRASH_DIRECTORY, trashName);

      await rename(sourceAbsolutePath, trashAbsolutePath);

      newRecords.push({
        id,
        originalPath: relativePath,
        trashPath: `.connorhub/trash/${trashName}`,
        deletedAt: new Date().toISOString(),
      });
    }

    await writeTrashRecords([...existingRecords, ...newRecords]);

    await pushOperation({
      type: "trash-many",
      trashRecordIds: newRecords.map((record) => record.id),
    });

    return NextResponse.json({
      success: true,
      records: newRecords,
    });
  } catch (error) {
    console.error("Unable to move selected items to Trash:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The selected items could not be moved to Trash.",
      },
      { status: 500 },
    );
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

function removeNestedSelections(paths: string[]): string[] {
  const uniquePaths = [...new Set(paths)];

  return uniquePaths.filter(
    (candidate) =>
      !uniquePaths.some(
        (possibleParent) =>
          possibleParent !== candidate &&
          candidate.startsWith(`${possibleParent}/`),
      ),
  );
}
