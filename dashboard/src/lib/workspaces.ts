import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { invalidateSearchIndex } from "@/lib/universal-search";

import { CONNORHUB_ROOT } from "@/lib/server-data";

const WORKSPACES_DIRECTORY = path.join(
  CONNORHUB_ROOT,
  ".connorhub",
  "workspaces",
);

const WORKSPACES_INDEX_FILE = path.join(WORKSPACES_DIRECTORY, "index.json");

export type WorkspaceTask = {
  id: string;
  text: string;
  completed: boolean;
};

export type WorkspaceLink = {
  id: string;
  title: string;
  url: string;
};

export type FolderWorkspace = {
  folderPath: string;
  notes: string;
  tasks: WorkspaceTask[];
  links: WorkspaceLink[];
  updatedAt: string | null;
};

type WorkspaceFileData = {
  notes: string;
  tasks: WorkspaceTask[];
  links: WorkspaceLink[];
};

type WorkspaceIndex = Record<string, string>;

export async function getWorkspace(
  folderPath: string,
): Promise<FolderWorkspace> {
  const normalizedFolderPath = normalizeFolderPath(folderPath);

  await ensureFolderExists(normalizedFolderPath);
  await ensureWorkspaceDirectory();

  const index = await readWorkspaceIndex();
  const workspaceFileName = index[normalizedFolderPath];

  if (!workspaceFileName) {
    return createEmptyWorkspace(normalizedFolderPath);
  }

  const workspaceAbsolutePath = path.join(
    WORKSPACES_DIRECTORY,
    workspaceFileName,
  );

  try {
    const [contents, workspaceStats] = await Promise.all([
      readFile(workspaceAbsolutePath, "utf8"),
      stat(workspaceAbsolutePath),
    ]);

    const parsed: unknown = JSON.parse(contents);
    const data = parseWorkspaceFileData(parsed);

    return {
      folderPath: normalizedFolderPath,
      notes: data.notes,
      tasks: data.tasks,
      links: data.links,
      updatedAt: workspaceStats.mtime.toISOString(),
    };
  } catch (error) {
    if (hasNodeErrorCode(error, "ENOENT")) {
      return createEmptyWorkspace(normalizedFolderPath);
    }

    throw error;
  }
}

export async function saveWorkspace({
  folderPath,
  notes,
  tasks,
  links,
}: {
  folderPath: string;
  notes: string;
  tasks: WorkspaceTask[];
  links: WorkspaceLink[];
}): Promise<FolderWorkspace> {
  const normalizedFolderPath = normalizeFolderPath(folderPath);

  await ensureFolderExists(normalizedFolderPath);
  await ensureWorkspaceDirectory();

  const sanitizedWorkspace = sanitizeWorkspaceData({
    notes,
    tasks,
    links,
  });

  const index = await readWorkspaceIndex();

  let workspaceFileName = index[normalizedFolderPath];

  if (!workspaceFileName) {
    workspaceFileName = createWorkspaceFileName(normalizedFolderPath);
    index[normalizedFolderPath] = workspaceFileName;

    await writeWorkspaceIndex(index);
  }

  const workspaceAbsolutePath = path.join(
    WORKSPACES_DIRECTORY,
    workspaceFileName,
  );

  await writeFile(
    workspaceAbsolutePath,
    JSON.stringify(sanitizedWorkspace, null, 2),
    "utf8",
  );

  await invalidateSearchIndex();

  const workspaceStats = await stat(workspaceAbsolutePath);

  return {
    folderPath: normalizedFolderPath,
    notes: sanitizedWorkspace.notes,
    tasks: sanitizedWorkspace.tasks,
    links: sanitizedWorkspace.links,
    updatedAt: workspaceStats.mtime.toISOString(),
  };
}

export function createWorkspaceTask(text: string): WorkspaceTask {
  return {
    id: randomUUID(),
    text: text.trim(),
    completed: false,
  };
}

export function createWorkspaceLink({
  title,
  url,
}: {
  title: string;
  url: string;
}): WorkspaceLink {
  return {
    id: randomUUID(),
    title: title.trim(),
    url: url.trim(),
  };
}

function createEmptyWorkspace(folderPath: string): FolderWorkspace {
  return {
    folderPath,
    notes: "",
    tasks: [],
    links: [],
    updatedAt: null,
  };
}

function sanitizeWorkspaceData(
  workspace: WorkspaceFileData,
): WorkspaceFileData {
  return {
    notes: typeof workspace.notes === "string" ? workspace.notes : "",
    tasks: Array.isArray(workspace.tasks)
      ? workspace.tasks
          .filter(isWorkspaceTask)
          .map((task) => ({
            id: task.id,
            text: task.text.trim(),
            completed: task.completed,
          }))
          .filter((task) => task.text.length > 0)
      : [],
    links: Array.isArray(workspace.links)
      ? workspace.links
          .filter(isWorkspaceLink)
          .map((link) => ({
            id: link.id,
            title: link.title.trim(),
            url: link.url.trim(),
          }))
          .filter((link) => link.title.length > 0 && link.url.length > 0)
      : [],
  };
}

function parseWorkspaceFileData(value: unknown): WorkspaceFileData {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      notes: "",
      tasks: [],
      links: [],
    };
  }

  const record = value as Record<string, unknown>;

  return sanitizeWorkspaceData({
    notes: typeof record.notes === "string" ? record.notes : "",
    tasks: Array.isArray(record.tasks)
      ? record.tasks.filter(isWorkspaceTask)
      : [],
    links: Array.isArray(record.links)
      ? record.links.filter(isWorkspaceLink)
      : [],
  });
}

function isWorkspaceTask(value: unknown): value is WorkspaceTask {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.text === "string" &&
    typeof record.completed === "boolean"
  );
}

function isWorkspaceLink(value: unknown): value is WorkspaceLink {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.url === "string"
  );
}

async function ensureFolderExists(folderPath: string): Promise<void> {
  const absoluteFolderPath = path.resolve(CONNORHUB_ROOT, folderPath);

  if (!isInsideConnorHubRoot(absoluteFolderPath)) {
    throw new Error("The folder is outside ConnorHub storage.");
  }

  const folderStats = await stat(absoluteFolderPath);

  if (!folderStats.isDirectory()) {
    throw new Error("Workspaces can only be attached to folders.");
  }
}

async function ensureWorkspaceDirectory(): Promise<void> {
  await mkdir(WORKSPACES_DIRECTORY, {
    recursive: true,
  });
}

async function readWorkspaceIndex(): Promise<WorkspaceIndex> {
  try {
    const contents = await readFile(WORKSPACES_INDEX_FILE, "utf8");

    const parsed: unknown = JSON.parse(contents);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }

    return parsed as WorkspaceIndex;
  } catch (error) {
    if (hasNodeErrorCode(error, "ENOENT")) {
      return {};
    }

    throw error;
  }
}

async function writeWorkspaceIndex(index: WorkspaceIndex): Promise<void> {
  await ensureWorkspaceDirectory();

  await writeFile(
    WORKSPACES_INDEX_FILE,
    JSON.stringify(index, null, 2),
    "utf8",
  );
}

function createWorkspaceFileName(folderPath: string): string {
  const hash = createHash("sha256")
    .update(folderPath || "/")
    .digest("hex")
    .slice(0, 24);

  return `${hash}.json`;
}

function normalizeFolderPath(value: string): string {
  return value
    .replaceAll("\\", "/")
    .split("/")
    .filter(
      (segment) => segment.length > 0 && segment !== "." && segment !== "..",
    )
    .join("/");
}

function isInsideConnorHubRoot(candidatePath: string): boolean {
  const resolvedRoot = path.resolve(CONNORHUB_ROOT);
  const resolvedCandidate = path.resolve(candidatePath);

  const relativePath = path.relative(resolvedRoot, resolvedCandidate);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

function hasNodeErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}
