import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { CONNORHUB_ROOT } from "@/lib/server-data";

const SHARE_DIRECTORY = path.join(CONNORHUB_ROOT, ".connorhub");
const SHARE_TOKEN_FILE = path.join(SHARE_DIRECTORY, "share-tokens.json");

export type ShareTokenRecord = {
  token: string;
  relativePath: string;
  createdAt: string;
  expiresAt: string;
};

export async function createShareToken(
  relativePath: string,
  lifetimeMinutes = 5,
): Promise<ShareTokenRecord> {
  const records = await readShareTokens();
  const now = Date.now();

  const activeRecords = records.filter(
    (record) => new Date(record.expiresAt).getTime() > now,
  );

  const record: ShareTokenRecord = {
    token: createToken(),
    relativePath: sanitizeRelativePath(relativePath),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + lifetimeMinutes * 60_000).toISOString(),
  };

  activeRecords.push(record);
  await writeShareTokens(activeRecords);

  return record;
}

export async function getShareToken(
  token: string,
): Promise<ShareTokenRecord | null> {
  const records = await readShareTokens();
  const now = Date.now();

  const activeRecords = records.filter(
    (record) => new Date(record.expiresAt).getTime() > now,
  );

  if (activeRecords.length !== records.length) {
    await writeShareTokens(activeRecords);
  }

  return activeRecords.find((record) => record.token === token) ?? null;
}

async function readShareTokens(): Promise<ShareTokenRecord[]> {
  try {
    const contents = await readFile(SHARE_TOKEN_FILE, "utf8");
    return JSON.parse(contents) as ShareTokenRecord[];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeShareTokens(records: ShareTokenRecord[]): Promise<void> {
  await mkdir(SHARE_DIRECTORY, {
    recursive: true,
  });

  await writeFile(SHARE_TOKEN_FILE, JSON.stringify(records, null, 2), "utf8");
}

function createToken(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12);
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
