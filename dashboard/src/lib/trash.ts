import "server-only";

import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { CONNORHUB_ROOT } from "@/lib/server-data";

export type TrashRecord = {
  id: string;
  originalPath: string;
  trashPath: string;
  deletedAt: string;
};

const TRASH_DIRECTORY = path.join(CONNORHUB_ROOT, ".connorhub", "trash");

const TRASH_INDEX = path.join(TRASH_DIRECTORY, "index.json");

export async function readTrashRecords(): Promise<TrashRecord[]> {
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

export async function writeTrashRecords(records: TrashRecord[]): Promise<void> {
  await mkdir(TRASH_DIRECTORY, {
    recursive: true,
  });

  await writeFile(TRASH_INDEX, JSON.stringify(records, null, 2), "utf8");
}

export async function restoreTrashRecord(
  recordId: string,
): Promise<TrashRecord> {
  const records = await readTrashRecords();
  const record = records.find((item) => item.id === recordId);

  if (!record) {
    throw new Error("The Trash item could not be found.");
  }

  const trashAbsolutePath = path.join(
    CONNORHUB_ROOT,
    ...record.trashPath.split("/"),
  );

  const originalAbsolutePath = path.join(
    CONNORHUB_ROOT,
    ...record.originalPath.split("/"),
  );

  if (await pathExists(originalAbsolutePath)) {
    throw new Error("An item already exists at the original location.");
  }

  await mkdir(path.dirname(originalAbsolutePath), {
    recursive: true,
  });

  await rename(trashAbsolutePath, originalAbsolutePath);

  await writeTrashRecords(records.filter((item) => item.id !== record.id));

  return record;
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
