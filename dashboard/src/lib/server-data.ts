import { realpath, readdir, stat, statfs } from "node:fs/promises";
import path from "node:path";

export const CONNORHUB_ROOT = process.env.CONNORHUB_ROOT ?? "/srv/connorhub";

export async function resolveConnorHubPath(
  requestedPath: string,
): Promise<string> {
  const resolvedRoot = await realpath(CONNORHUB_ROOT);

  const normalizedPath = requestedPath
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join(path.sep);

  const candidatePath = path.resolve(resolvedRoot, normalizedPath);

  const isInsideRoot =
    candidatePath === resolvedRoot ||
    candidatePath.startsWith(`${resolvedRoot}${path.sep}`);

  if (!isInsideRoot) {
    throw new Error("Requested path is outside ConnorHub storage.");
  }

  const resolvedCandidate = await realpath(candidatePath);

  const resolvedCandidateIsInsideRoot =
    resolvedCandidate === resolvedRoot ||
    resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`);

  if (!resolvedCandidateIsInsideRoot) {
    throw new Error("Requested path resolves outside ConnorHub storage.");
  }

  return resolvedCandidate;
}

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

export type FileBrowserItem = {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  sizeBytes: number;
  modifiedAt: Date;
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

    await scanDirectory(CONNORHUB_ROOT, CONNORHUB_ROOT, results, 0, 2);

    return results
      .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime())
      .slice(0, limit);
  } catch (error) {
    console.error("Unable to read recent ConnorHub files:", error);
    return [];
  }
}

export async function getDirectoryContents(
  requestedPath = "",
): Promise<FileBrowserItem[]> {
  const absolutePath = await resolveConnorHubPath(requestedPath);
  const resolvedRoot = await realpath(CONNORHUB_ROOT);

  const entries = await readdir(absolutePath, {
    withFileTypes: true,
  });

  const items = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith("."))
      .map(async (entry) => {
        const entryAbsolutePath = path.join(absolutePath, entry.name);
        const fileStats = await stat(entryAbsolutePath);

        return {
          name: entry.name,
          relativePath: path
            .relative(resolvedRoot, entryAbsolutePath)
            .split(path.sep)
            .join("/"),
          isDirectory: entry.isDirectory(),
          sizeBytes: entry.isDirectory() ? 0 : fileStats.size,
          modifiedAt: fileStats.mtime,
        };
      }),
  );

  return items.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }

    return a.name.localeCompare(b.name, undefined, {
      sensitivity: "base",
    });
  });
}

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
]);

async function scanDirectory(
  directory: string,
  rootDirectory: string,
  results: RecentFile[],
  currentDepth: number,
  maxDepth: number,
): Promise<void> {
  const entries = await readdir(directory, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
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

    if (entry.isDirectory() && currentDepth < maxDepth) {
      await scanDirectory(
        absolutePath,
        rootDirectory,
        results,
        currentDepth + 1,
        maxDepth,
      );
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
