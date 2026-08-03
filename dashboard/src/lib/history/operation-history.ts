import "server-only";

import {
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { CONNORHUB_ROOT } from "@/lib/server-data";

const HISTORY_DIRECTORY = path.join(CONNORHUB_ROOT, ".connorhub");
const HISTORY_FILE = path.join(HISTORY_DIRECTORY, "operation-history.json");
const MAX_HISTORY_LENGTH = 50;

export type FileOperation =
  | {
      id: string;
      type: "trash";
      createdAt: string;
      trashRecordId: string;
    }
  | {
      id: string;
      type: "move";
      createdAt: string;
      fromPath: string;
      toPath: string;
    }
  | {
      id: string;
      type: "duplicate";
      createdAt: string;
      duplicatePath: string;
    }
  | {
      id: string;
      type: "rename";
      createdAt: string;
      fromPath: string;
      toPath: string;
    };

export type NewFileOperation =
  | {
      type: "trash";
      trashRecordId: string;
    }
  | {
      type: "move";
      fromPath: string;
      toPath: string;
    }
  | {
      type: "duplicate";
      duplicatePath: string;
    }
  | {
      type: "rename";
      fromPath: string;
      toPath: string;
    };

export async function pushOperation(
  operation: NewFileOperation,
): Promise<FileOperation> {
  const operations = await readOperations();

  const savedOperation = {
    ...operation,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  } as FileOperation;

  operations.push(savedOperation);

  const limitedOperations = operations.slice(-MAX_HISTORY_LENGTH);

  await writeOperations(limitedOperations);

  return savedOperation;
}

export async function peekLastOperation(): Promise<FileOperation | null> {
  const operations = await readOperations();

  return operations.at(-1) ?? null;
}

export async function popLastOperation(): Promise<FileOperation | null> {
  const operations = await readOperations();
  const operation = operations.pop() ?? null;

  await writeOperations(operations);

  return operation;
}

export async function restoreOperation(
  operation: FileOperation,
): Promise<void> {
  const operations = await readOperations();

  operations.push(operation);
  await writeOperations(operations);
}

async function readOperations(): Promise<FileOperation[]> {
  try {
    const contents = await readFile(HISTORY_FILE, "utf8");

    return JSON.parse(contents) as FileOperation[];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeOperations(operations: FileOperation[]): Promise<void> {
  await mkdir(HISTORY_DIRECTORY, {
    recursive: true,
  });

  await writeFile(HISTORY_FILE, JSON.stringify(operations, null, 2), "utf8");
}
