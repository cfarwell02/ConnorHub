import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { CONNORHUB_ROOT, resolveConnorHubPath } from "@/lib/server-data";

export type TrashRecord = {
  id: string;
  originalPath: string;
  trashPath: string;
  deletedAt: string;
};

const TRASH_DIRECTORY = path.join(CONNORHUB_ROOT, ".connorhub", "trash");

const TRASH_INDEX = path.join(TRASH_DIRECTORY, "index.json");

export async function GET() {
  try {
    const records = await readTrashRecords();

    return NextResponse.json({
      records,
    });
  } catch (error) {
    console.error("Unable to read Trash:", error);

    return NextResponse.json(
      { error: "Trash could not be loaded." },
      { status: 500 },
    );
  }
}

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

    const relativePath = sanitizeRelativePath(body.relativePath);

    if (!relativePath) {
      return NextResponse.json(
        { error: "The ConnorHub root cannot be moved to Trash." },
        { status: 400 },
      );
    }

    if (
      relativePath === ".connorhub" ||
      relativePath.startsWith(".connorhub/")
    ) {
      return NextResponse.json(
        { error: "ConnorHub system files cannot be moved to Trash." },
        { status: 400 },
      );
    }

    const sourceAbsolutePath = await resolveConnorHubPath(relativePath);

    await mkdir(TRASH_DIRECTORY, {
      recursive: true,
    });

    const id = crypto.randomUUID();
    const originalName = path.basename(sourceAbsolutePath);
    const trashName = `${id}-${originalName}`;
    const trashAbsolutePath = path.join(TRASH_DIRECTORY, trashName);

    await rename(sourceAbsolutePath, trashAbsolutePath);

    const records = await readTrashRecords();

    const record: TrashRecord = {
      id,
      originalPath: relativePath,
      trashPath: `.connorhub/trash/${trashName}`,
      deletedAt: new Date().toISOString(),
    };

    records.push(record);
    await writeTrashRecords(records);

    return NextResponse.json({
      success: true,
      record,
    });
  } catch (error) {
    console.error("Unable to move item to Trash:", error);

    return NextResponse.json(
      { error: "The item could not be moved to Trash." },
      { status: 500 },
    );
  }
}

async function readTrashRecords(): Promise<TrashRecord[]> {
  try {
    const contents = await readFile(TRASH_INDEX, "utf8");
    return JSON.parse(contents) as TrashRecord[];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeTrashRecords(records: TrashRecord[]): Promise<void> {
  await writeFile(TRASH_INDEX, JSON.stringify(records, null, 2), "utf8");
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
