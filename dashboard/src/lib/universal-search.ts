import "server-only";

import {
  mkdir,
  readFile as readJsonFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { CONNORHUB_ROOT } from "@/lib/server-data";
import {
  getSearchIndexState,
  markSearchIndexClean,
  markSearchIndexDirty,
} from "@/lib/metadata-store";

export type UniversalSearchResult = {
  id: string;
  name: string;
  relativePath: string;
  parentPath: string;
  type:
    | "file"
    | "folder"
    | "workspace-note"
    | "workspace-task"
    | "workspace-link";
  extension: string | null;
  sourceFolderPath?: string;
  matchedText?: string;
  url?: string;
};

let cachedIndex: UniversalSearchResult[] | null = null;
let indexBuildPromise: Promise<UniversalSearchResult[]> | null = null;

const SEARCH_INDEX_DIRECTORY = path.join(CONNORHUB_ROOT, ".connorhub");

const SEARCH_INDEX_FILE = path.join(
  SEARCH_INDEX_DIRECTORY,
  "search-index.json",
);

const WORKSPACES_DIRECTORY = path.join(
  CONNORHUB_ROOT,
  ".connorhub",
  "workspaces",
);

const WORKSPACES_INDEX_FILE = path.join(WORKSPACES_DIRECTORY, "index.json");

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

export async function invalidateSearchIndex(): Promise<void> {
  cachedIndex = null;
  await markSearchIndexDirty();
}

async function indexWorkspaceContent(): Promise<UniversalSearchResult[]> {
  try {
    const indexContents = await readJsonFile(WORKSPACES_INDEX_FILE, "utf8");

    const workspaceIndex = JSON.parse(indexContents) as Record<string, string>;

    const workspaceResults = await Promise.all(
      Object.entries(workspaceIndex).map(async ([folderPath, fileName]) => {
        const workspaceAbsolutePath = path.join(WORKSPACES_DIRECTORY, fileName);

        try {
          const contents = await readJsonFile(workspaceAbsolutePath, "utf8");

          const parsed = JSON.parse(contents) as {
            notes?: unknown;
            tasks?: unknown;
            links?: unknown;
          };

          const results: UniversalSearchResult[] = [];

          if (typeof parsed.notes === "string" && parsed.notes.trim()) {
            results.push({
              id: `workspace-note:${folderPath}`,
              name: getWorkspaceName(folderPath),
              relativePath: folderPath,
              parentPath: getParentPath(folderPath),
              type: "workspace-note",
              extension: null,
              sourceFolderPath: folderPath,
              matchedText: parsed.notes,
            });
          }

          if (Array.isArray(parsed.tasks)) {
            for (const task of parsed.tasks) {
              if (
                typeof task === "object" &&
                task !== null &&
                "id" in task &&
                "text" in task &&
                typeof task.id === "string" &&
                typeof task.text === "string"
              ) {
                results.push({
                  id: `workspace-task:${folderPath}:${task.id}`,
                  name: task.text,
                  relativePath: folderPath,
                  parentPath: folderPath,
                  type: "workspace-task",
                  extension: null,
                  sourceFolderPath: folderPath,
                  matchedText: task.text,
                });
              }
            }
          }

          if (Array.isArray(parsed.links)) {
            for (const link of parsed.links) {
              if (
                typeof link === "object" &&
                link !== null &&
                "id" in link &&
                "title" in link &&
                "url" in link &&
                typeof link.id === "string" &&
                typeof link.title === "string" &&
                typeof link.url === "string"
              ) {
                results.push({
                  id: `workspace-link:${folderPath}:${link.id}`,
                  name: link.title,
                  relativePath: folderPath,
                  parentPath: folderPath,
                  type: "workspace-link",
                  extension: null,
                  sourceFolderPath: folderPath,
                  matchedText: `${link.title} ${link.url}`,
                  url: link.url,
                });
              }
            }
          }

          return results;
        } catch (error) {
          console.error(`Unable to index workspace: ${folderPath}`, error);

          return [];
        }
      }),
    );

    return workspaceResults.flat();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    console.error("Unable to index workspaces:", error);
    return [];
  }
}

function getWorkspaceName(folderPath: string): string {
  if (!folderPath) {
    return "ConnorHub Workspace";
  }

  return `${path.basename(folderPath)} Workspace`;
}

async function getSearchIndex(): Promise<UniversalSearchResult[]> {
  const searchState = await getSearchIndexState();

  if (!searchState.dirty && cachedIndex !== null) {
    return cachedIndex;
  }

  if (indexBuildPromise !== null) {
    return indexBuildPromise;
  }

  indexBuildPromise = searchState.dirty
    ? rebuildSearchIndex()
    : loadOrBuildSearchIndex();

  try {
    const index = await indexBuildPromise;

    cachedIndex = index;

    return index;
  } finally {
    indexBuildPromise = null;
  }
}

async function rebuildSearchIndex(): Promise<UniversalSearchResult[]> {
  const newIndex = await buildSearchIndex();

  await saveSearchIndex(newIndex);
  await markSearchIndexClean(newIndex.length);

  return newIndex;
}

async function buildSearchIndex(): Promise<UniversalSearchResult[]> {
  const startedAt = performance.now();

  const [fileResults, workspaceResults] = await Promise.all([
    indexDirectory(CONNORHUB_ROOT),
    indexWorkspaceContent(),
  ]);

  const results = [...fileResults, ...workspaceResults];

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
    const contents = await readJsonFile(SEARCH_INDEX_FILE, "utf8");

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
  const matchedText = result.matchedText?.toLowerCase() ?? "";

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

  if (matchedText.includes(query)) {
    return 40;
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
