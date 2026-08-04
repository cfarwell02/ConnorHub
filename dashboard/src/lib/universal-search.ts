import "server-only";

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { CONNORHUB_ROOT } from "@/lib/server-data";

export type UniversalSearchResult = {
  id: string;
  name: string;
  relativePath: string;
  parentPath: string;
  type: "file" | "folder";
  extension: string | null;
};

let cachedIndex: UniversalSearchResult[] | null = null;
let indexCreatedAt = 0;
let indexBuildPromise: Promise<UniversalSearchResult[]> | null = null;

const SEARCH_INDEX_DIRECTORY = path.join(CONNORHUB_ROOT, ".connorhub");

const SEARCH_INDEX_FILE = path.join(
  SEARCH_INDEX_DIRECTORY,
  "search-index.json",
);

const INDEX_LIFETIME_MS = 5 * 60_000;
const MAX_RESULTS = 50;

export async function searchConnorHub(
  query: string,
): Promise<UniversalSearchResult[]> {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const index = await getSearchIndex();

  return index
    .map((result) => ({
      result,
      score: calculateSearchScore(result, normalizedQuery),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }

      if (a.result.type !== b.result.type) {
        return a.result.type === "folder" ? -1 : 1;
      }

      return a.result.name.localeCompare(b.result.name, undefined, {
        sensitivity: "base",
      });
    })
    .slice(0, MAX_RESULTS)
    .map(({ result }) => result);
}

let indexDirty = false;

export function invalidateSearchIndex() {
  indexDirty = true;
}

async function getSearchIndex(): Promise<UniversalSearchResult[]> {
  if (
    !indexDirty &&
    cachedIndex !== null &&
    Date.now() - indexCreatedAt < INDEX_LIFETIME_MS
  ) {
    return cachedIndex;
  }

  if (indexBuildPromise) {
    return indexBuildPromise;
  }

  indexBuildPromise = indexDirty
    ? rebuildSearchIndex()
    : loadOrBuildSearchIndex();

  try {
    const index = await indexBuildPromise;

    cachedIndex = index;
    indexCreatedAt = Date.now();
    indexDirty = false;

    return index;
  } finally {
    indexBuildPromise = null;
  }
}

async function rebuildSearchIndex(): Promise<UniversalSearchResult[]> {
  const newIndex = await buildSearchIndex();

  await saveSearchIndex(newIndex);

  return newIndex;
}

async function buildSearchIndex(): Promise<UniversalSearchResult[]> {
  const startedAt = performance.now();

  const results = await indexDirectory(CONNORHUB_ROOT);

  console.log(
    `ConnorHub search index: ${results.length} items in ${Math.round(
      performance.now() - startedAt,
    )}ms`,
  );

  return results;
}

async function loadOrBuildSearchIndex(): Promise<UniversalSearchResult[]> {
  const savedIndex = await readSavedSearchIndex();

  if (savedIndex !== null) {
    console.log(`ConnorHub search index loaded: ${savedIndex.length} items`);

    return savedIndex;
  }

  return rebuildSearchIndex();
}

async function readSavedSearchIndex(): Promise<UniversalSearchResult[] | null> {
  try {
    const contents = await readFile(SEARCH_INDEX_FILE, "utf8");

    const parsed: unknown = JSON.parse(contents);

    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed as UniversalSearchResult[];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    console.error("Unable to load saved ConnorHub search index:", error);

    return null;
  }
}

async function saveSearchIndex(index: UniversalSearchResult[]): Promise<void> {
  await mkdir(SEARCH_INDEX_DIRECTORY, {
    recursive: true,
  });

  await writeFile(SEARCH_INDEX_FILE, JSON.stringify(index), "utf8");
}

async function indexDirectory(
  absoluteDirectory: string,
): Promise<UniversalSearchResult[]> {
  let entries;

  try {
    entries = await readdir(absoluteDirectory, {
      withFileTypes: true,
    });
  } catch (error) {
    console.error(`Unable to index directory: ${absoluteDirectory}`, error);

    return [];
  }

  const currentResults: UniversalSearchResult[] = [];
  const childDirectoryPromises: Promise<UniversalSearchResult[]>[] = [];

  for (const entry of entries) {
    if (shouldIgnoreEntry(entry.name)) {
      continue;
    }

    // Avoid following symlinks during recursive indexing.
    if (!entry.isFile() && !entry.isDirectory()) {
      continue;
    }

    const absolutePath = path.join(absoluteDirectory, entry.name);

    const relativePath = path
      .relative(CONNORHUB_ROOT, absolutePath)
      .split(path.sep)
      .join("/");

    currentResults.push({
      id: relativePath,
      name: entry.name,
      relativePath,
      parentPath: getParentPath(relativePath),
      type: entry.isDirectory() ? "folder" : "file",
      extension: entry.isDirectory() ? null : getExtension(entry.name),
    });

    if (entry.isDirectory()) {
      childDirectoryPromises.push(indexDirectory(absolutePath));
    }
  }

  const childResults = await Promise.all(childDirectoryPromises);

  return currentResults.concat(...childResults);
}

function calculateSearchScore(
  result: UniversalSearchResult,
  query: string,
): number {
  const name = result.name.toLowerCase();
  const relativePath = result.relativePath.toLowerCase();

  if (name === query) {
    return 100;
  }

  if (name.startsWith(query)) {
    return 75;
  }

  if (name.includes(query)) {
    return 50;
  }

  if (relativePath.includes(query)) {
    return 25;
  }

  return 0;
}

function shouldIgnoreEntry(name: string): boolean {
  return name === ".connorhub" || name === ".DS_Store" || name === "Thumbs.db";
}

function getParentPath(relativePath: string): string {
  return relativePath.split("/").filter(Boolean).slice(0, -1).join("/");
}

function getExtension(fileName: string): string | null {
  const extension = path.extname(fileName).slice(1).toLowerCase();

  return extension || null;
}

export async function warmSearchIndex(): Promise<void> {
  await getSearchIndex();
}
