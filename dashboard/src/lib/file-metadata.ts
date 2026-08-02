import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

const STORAGE_ROOT =
  process.env.CONNORHUB_ROOT ?? path.join(process.cwd(), "..", "storage");

const METADATA_DIRECTORY = path.join(STORAGE_ROOT, ".connorhub");
const METADATA_FILE = path.join(METADATA_DIRECTORY, "metadata.json");

type FileMetadataRecord = {
  pinned?: boolean;
};

type FileMetadataDatabase = Record<string, FileMetadataRecord>;

export async function getPinnedPaths(): Promise<string[]> {
  const metadata = await readMetadata();

  return Object.entries(metadata)
    .filter(([, record]) => record.pinned)
    .map(([relativePath]) => relativePath);
}

export async function togglePinned(relativePath: string): Promise<boolean> {
  const safePath = sanitizeRelativePath(relativePath);
  const metadata = await readMetadata();

  const nextPinned = !metadata[safePath]?.pinned;

  metadata[safePath] = {
    ...metadata[safePath],
    pinned: nextPinned,
  };

  if (!nextPinned && Object.keys(metadata[safePath]).length === 1) {
    delete metadata[safePath];
  }

  await writeMetadata(metadata);

  return nextPinned;
}

async function readMetadata(): Promise<FileMetadataDatabase> {
  try {
    const contents = await fs.readFile(METADATA_FILE, "utf8");
    return JSON.parse(contents) as FileMetadataDatabase;
  } catch (error) {
    if (isMissingFileError(error)) {
      return {};
    }

    throw error;
  }
}

async function writeMetadata(metadata: FileMetadataDatabase): Promise<void> {
  await fs.mkdir(METADATA_DIRECTORY, { recursive: true });

  await fs.writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2), "utf8");
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

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
