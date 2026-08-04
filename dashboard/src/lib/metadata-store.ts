import "server-only";

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { CONNORHUB_ROOT } from "@/lib/server-data";
import type { ConnorHubMetadata } from "@/types/metadata";

const METADATA_DIRECTORY = path.join(CONNORHUB_ROOT, ".connorhub");

const METADATA_FILE = path.join(METADATA_DIRECTORY, "metadata.json");

const TEMPORARY_METADATA_FILE = path.join(
  METADATA_DIRECTORY,
  "metadata.tmp.json",
);

let cachedMetadata: ConnorHubMetadata | null = null;

/**
 * Serializes metadata mutations so two API requests cannot overwrite
 * each other's changes.
 */
let mutationQueue: Promise<void> = Promise.resolve();

export async function getMetadata(): Promise<ConnorHubMetadata> {
  if (cachedMetadata !== null) {
    return structuredClone(cachedMetadata);
  }

  const metadata = await readMetadataFile();

  cachedMetadata = metadata;

  return structuredClone(metadata);
}

export async function updateMetadata(
  updater: (
    current: ConnorHubMetadata,
  ) => ConnorHubMetadata | Promise<ConnorHubMetadata>,
): Promise<ConnorHubMetadata> {
  let updatedMetadata: ConnorHubMetadata | null = null;

  const mutation = mutationQueue.then(async () => {
    const current = await getMetadata();

    const next = await updater(current);

    updatedMetadata = {
      ...next,
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
    };

    await writeMetadataFile(updatedMetadata);

    cachedMetadata = updatedMetadata;
  });

  mutationQueue = mutation.catch(() => {
    // Keep the queue usable after a failed mutation.
  });

  await mutation;

  if (updatedMetadata === null) {
    throw new Error("ConnorHub metadata was not updated.");
  }

  return structuredClone(updatedMetadata);
}

export async function markSearchIndexDirty(): Promise<void> {
  await updateMetadata((current) => ({
    ...current,
    search: {
      ...current.search,
      dirty: true,
    },
  }));
}

export async function markSearchIndexClean(entryCount: number): Promise<void> {
  await updateMetadata((current) => ({
    ...current,
    search: {
      indexedAt: new Date().toISOString(),
      dirty: false,
      entryCount,
    },
  }));
}

export async function getSearchIndexState(): Promise<
  ConnorHubMetadata["search"]
> {
  const metadata = await getMetadata();

  return metadata.search;
}

export function clearMetadataMemoryCache(): void {
  cachedMetadata = null;
}

async function readMetadataFile(): Promise<ConnorHubMetadata> {
  try {
    const contents = await readFile(METADATA_FILE, "utf8");
    const parsed: unknown = JSON.parse(contents);

    return parseMetadata(parsed);
  } catch (error) {
    if (hasNodeErrorCode(error, "ENOENT")) {
      const metadata = createEmptyMetadata();

      await writeMetadataFile(metadata);

      return metadata;
    }

    console.error("Unable to read ConnorHub metadata:", error);

    throw error;
  }
}

async function writeMetadataFile(metadata: ConnorHubMetadata): Promise<void> {
  await mkdir(METADATA_DIRECTORY, {
    recursive: true,
  });

  const serializedMetadata = JSON.stringify(metadata, null, 2);

  try {
    await writeFile(TEMPORARY_METADATA_FILE, serializedMetadata, "utf8");

    await rename(TEMPORARY_METADATA_FILE, METADATA_FILE);
  } catch (error) {
    await rm(TEMPORARY_METADATA_FILE, {
      force: true,
    }).catch(() => undefined);

    throw error;
  }
}

function createEmptyMetadata(): ConnorHubMetadata {
  const now = new Date().toISOString();

  return {
    schemaVersion: 1,
    updatedAt: now,

    search: {
      indexedAt: null,
      dirty: true,
      entryCount: 0,
    },

    workspaces: {
      byFolderPath: {},
    },

    recentItems: [],
  };
}

function parseMetadata(value: unknown): ConnorHubMetadata {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return createEmptyMetadata();
  }

  const record = value as Record<string, unknown>;

  if (record.schemaVersion !== 1) {
    return createEmptyMetadata();
  }

  const emptyMetadata = createEmptyMetadata();

  const search =
    typeof record.search === "object" &&
    record.search !== null &&
    !Array.isArray(record.search)
      ? (record.search as Record<string, unknown>)
      : null;

  const workspaces =
    typeof record.workspaces === "object" &&
    record.workspaces !== null &&
    !Array.isArray(record.workspaces)
      ? (record.workspaces as Record<string, unknown>)
      : null;

  return {
    schemaVersion: 1,

    updatedAt:
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : emptyMetadata.updatedAt,

    search: {
      indexedAt:
        search && typeof search.indexedAt === "string"
          ? search.indexedAt
          : null,

      dirty: search && typeof search.dirty === "boolean" ? search.dirty : true,

      entryCount:
        search &&
        typeof search.entryCount === "number" &&
        Number.isFinite(search.entryCount)
          ? search.entryCount
          : 0,
    },

    workspaces: {
      byFolderPath:
        workspaces &&
        typeof workspaces.byFolderPath === "object" &&
        workspaces.byFolderPath !== null &&
        !Array.isArray(workspaces.byFolderPath)
          ? (workspaces.byFolderPath as ConnorHubMetadata["workspaces"]["byFolderPath"])
          : {},
    },

    recentItems: Array.isArray(record.recentItems)
      ? (record.recentItems as ConnorHubMetadata["recentItems"])
      : [],
  };
}

function hasNodeErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}
