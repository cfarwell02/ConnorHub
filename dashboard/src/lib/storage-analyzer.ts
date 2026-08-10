import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { CONNORHUB_ROOT } from "@/lib/server-data";
import type { UniversalSearchResult } from "@/lib/universal-search";

export type LargestFile = {
  name: string;
  relativePath: string;
  sizeBytes: number;
};

export type FolderUsage = {
  name: string;
  relativePath: string;
  sizeBytes: number;
};
export type FileTypeUsage = {
  category: string;
  sizeBytes: number;
  fileCount: number;
  percentage: number;
};

export type StorageAnalysis = {
  totalFiles: number;
  totalFolders: number;
  totalSizeBytes: number;
  largestFiles: LargestFile[];
  largestFolders: FolderUsage[];
  fileTypeBreakdown: FileTypeUsage[];
};

const SEARCH_INDEX_FILE = path.join(
  CONNORHUB_ROOT,
  ".connorhub",
  "search-index.json",
);

export async function analyzeConnorHubStorage(): Promise<StorageAnalysis> {
  const index = await readSearchIndex();

  const files = index.filter(
    (
      entry,
    ): entry is UniversalSearchResult & {
      type: "file";
      sizeBytes: number;
    } => entry.type === "file" && typeof entry.sizeBytes === "number",
  );

  const folders = index.filter((entry) => entry.type === "folder");

  const totalSizeBytes = files.reduce(
    (total, file) => total + file.sizeBytes,
    0,
  );

  const fileTypeBreakdown = calculateFileTypeBreakdown(files, totalSizeBytes);

  const largestFiles = [...files]
    .sort((a, b) => b.sizeBytes - a.sizeBytes)
    .slice(0, 15)
    .map((file) => ({
      name: file.name,
      relativePath: file.relativePath,
      sizeBytes: file.sizeBytes,
    }));

  const folderSizes = calculateFolderSizes(files);

  const largestFolders = folders
    .map((folder) => ({
      name: folder.name,
      relativePath: folder.relativePath,
      sizeBytes: folderSizes.get(folder.relativePath) ?? 0,
    }))
    .sort((a, b) => b.sizeBytes - a.sizeBytes)
    .slice(0, 10);

  return {
    totalFiles: files.length,
    totalFolders: folders.length,
    totalSizeBytes,
    largestFiles,
    largestFolders,
    fileTypeBreakdown,
  };
}

async function readSearchIndex(): Promise<UniversalSearchResult[]> {
  const contents = await readFile(SEARCH_INDEX_FILE, "utf8");

  const parsed: unknown = JSON.parse(contents);

  if (!Array.isArray(parsed)) {
    throw new Error("ConnorHub search index is invalid.");
  }

  return parsed as UniversalSearchResult[];
}

function calculateFolderSizes(
  files: Array<
    UniversalSearchResult & {
      type: "file";
      sizeBytes: number;
    }
  >,
): Map<string, number> {
  const folderSizes = new Map<string, number>();

  for (const file of files) {
    const segments = file.relativePath.split("/").filter(Boolean);

    // Last segment is the file itself.
    segments.pop();

    for (let index = 0; index < segments.length; index += 1) {
      const folderPath = segments.slice(0, index + 1).join("/");

      folderSizes.set(
        folderPath,
        (folderSizes.get(folderPath) ?? 0) + file.sizeBytes,
      );
    }
  }

  return folderSizes;
}

function calculateFileTypeBreakdown(
  files: Array<
    UniversalSearchResult & {
      type: "file";
      sizeBytes: number;
    }
  >,
  totalSizeBytes: number,
): FileTypeUsage[] {
  const categories = new Map<
    string,
    {
      sizeBytes: number;
      fileCount: number;
    }
  >();

  for (const file of files) {
    const category = getFileCategory(file.extension);

    const current = categories.get(category) ?? {
      sizeBytes: 0,
      fileCount: 0,
    };

    current.sizeBytes += file.sizeBytes;
    current.fileCount += 1;

    categories.set(category, current);
  }

  return Array.from(categories.entries())
    .map(([category, data]) => ({
      category,
      sizeBytes: data.sizeBytes,
      fileCount: data.fileCount,
      percentage:
        totalSizeBytes > 0 ? (data.sizeBytes / totalSizeBytes) * 100 : 0,
    }))
    .sort((a, b) => b.sizeBytes - a.sizeBytes);
}

function getFileCategory(extension: string | null): string {
  if (!extension) {
    return "Other";
  }

  const normalizedExtension = extension.toLowerCase();

  const videoExtensions = ["mp4", "mov", "mkv", "avi", "webm", "m4v"];

  const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg", "heic"];

  const audioExtensions = ["mp3", "wav", "m4a", "aac", "flac", "ogg"];

  const documentExtensions = [
    "pdf",
    "doc",
    "docx",
    "txt",
    "md",
    "rtf",
    "ppt",
    "pptx",
    "xls",
    "xlsx",
    "csv",
  ];

  const archiveExtensions = ["zip", "rar", "7z", "tar", "gz", "bz2"];

  const codeExtensions = [
    "js",
    "jsx",
    "ts",
    "tsx",
    "html",
    "css",
    "scss",
    "json",
    "py",
    "java",
    "c",
    "cpp",
    "h",
    "hpp",
    "go",
    "rs",
    "php",
    "sh",
    "sql",
    "yaml",
    "yml",
    "toml",
  ];

  if (videoExtensions.includes(normalizedExtension)) {
    return "Video";
  }

  if (imageExtensions.includes(normalizedExtension)) {
    return "Images";
  }

  if (audioExtensions.includes(normalizedExtension)) {
    return "Audio";
  }

  if (documentExtensions.includes(normalizedExtension)) {
    return "Documents";
  }

  if (archiveExtensions.includes(normalizedExtension)) {
    return "Archives";
  }

  if (codeExtensions.includes(normalizedExtension)) {
    return "Code";
  }

  return "Other";
}
