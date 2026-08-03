import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { CONNORHUB_ROOT } from "@/lib/server-data";

type TrashRecord = {
  id: string;
  originalPath: string;
  trashPath: string;
  deletedAt: string;
};

const TRASH_DIRECTORY = path.join(CONNORHUB_ROOT, ".connorhub", "trash");

const TRASH_INDEX = path.join(TRASH_DIRECTORY, "index.json");

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      id?: unknown;
    };

    if (typeof body.id !== "string" || body.id.trim().length === 0) {
      return NextResponse.json(
        { error: "A Trash record ID is required." },
        { status: 400 },
      );
    }

    const records = await readTrashRecords();
    const record = records.find((item) => item.id === body.id);

    if (!record) {
      return NextResponse.json(
        { error: "The Trash item could not be found." },
        { status: 404 },
      );
    }

    const trashAbsolutePath = path.join(
      CONNORHUB_ROOT,
      ...record.trashPath.split("/"),
    );

    const originalAbsolutePath = path.join(
      CONNORHUB_ROOT,
      ...record.originalPath.split("/"),
    );

    const destinationExists = await pathExists(originalAbsolutePath);

    if (destinationExists) {
      return NextResponse.json(
        {
          error:
            "An item already exists at the original location. Rename or move it before restoring.",
        },
        { status: 409 },
      );
    }

    await mkdir(path.dirname(originalAbsolutePath), {
      recursive: true,
    });

    await rename(trashAbsolutePath, originalAbsolutePath);

    const remainingRecords = records.filter((item) => item.id !== record.id);

    await writeTrashRecords(remainingRecords);

    return NextResponse.json({
      success: true,
      restoredPath: record.originalPath,
    });
  } catch (error) {
    console.error("Unable to restore Trash item:", error);

    return NextResponse.json(
      { error: "The item could not be restored." },
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
  await mkdir(TRASH_DIRECTORY, {
    recursive: true,
  });

  await writeFile(TRASH_INDEX, JSON.stringify(records, null, 2), "utf8");
}

async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await stat(absolutePath);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}
