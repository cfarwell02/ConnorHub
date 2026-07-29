import { readdir, stat, statfs } from "node:fs/promises";
import path from "node:path";

export const CONNORHUB_ROOT = process.env.CONNORHUB_ROOT ?? "/srv/connorhub";

export type RecentFile = {
  name: string;
  relativePath: string;
  location: string;
  modifiedAt: Date;
  isDirectory: boolean;
};

export type StorageInfo = {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
};

export async function getStorageInfo(): Promise<StorageInfo | null> {
  try {
    const storage = await statfs(CONNORHUB_ROOT);

    const totalBytes = storage.blocks * storage.bsize;
    const freeBytes = storage.bavail * storage.bsize;
    const usedBytes = totalBytes - freeBytes;

    return {
      totalBytes,
      usedBytes,
      freeBytes,
      usedPercent:
        totalBytes === 0 ? 0 : Math.round((usedBytes / totalBytes) * 100),
    };
  } catch (error) {
    console.error("Unable to read ConnorHub storage information:", error);
    return null;
  }
}

export async function getRecentFiles(limit = 8): Promise<RecentFile[]> {
  try {
    const results: RecentFile[] = [];

    await scanDirectory(CONNORHUB_ROOT, CONNORHUB_ROOT, results);

    return results
      .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime())
      .slice(0, limit);
  } catch (error) {
    console.error("Unable to read recent ConnorHub files:", error);
    return [];
  }
}

async function scanDirectory(
  directory: string,
  rootDirectory: string,
  results: RecentFile[],
): Promise<void> {
  const entries = await readdir(directory, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    // Ignore hidden files such as macOS metadata files.
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);
    const fileStats = await stat(absolutePath);
    const relativePath = path.relative(rootDirectory, absolutePath);

    results.push({
      name: entry.name,
      relativePath,
      location: relativePath.split(path.sep)[0] || "ConnorHub",
      modifiedAt: fileStats.mtime,
      isDirectory: entry.isDirectory(),
    });

    if (entry.isDirectory()) {
      await scanDirectory(absolutePath, rootDirectory, results);
    }
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

export function formatRelativeTime(date: Date): string {
  const differenceMs = Date.now() - date.getTime();
  const differenceMinutes = Math.floor(differenceMs / 60_000);

  if (differenceMinutes < 1) {
    return "Just now";
  }

  if (differenceMinutes < 60) {
    return `${differenceMinutes} minute${
      differenceMinutes === 1 ? "" : "s"
    } ago`;
  }

  const differenceHours = Math.floor(differenceMinutes / 60);

  if (differenceHours < 24) {
    return `${differenceHours} hour${differenceHours === 1 ? "" : "s"} ago`;
  }

  const differenceDays = Math.floor(differenceHours / 24);

  return `${differenceDays} day${differenceDays === 1 ? "" : "s"} ago`;
}
