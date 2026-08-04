import Link from "next/link";
import path from "node:path";
import { stat } from "node:fs/promises";
import {
  ArrowLeft,
  Download,
  File,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
} from "lucide-react";
import { readFile } from "node:fs/promises";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { codeToHtml } from "shiki";

import { getFilePresentation } from "@/lib/file-presentation";
import { resolveConnorHubPath } from "@/lib/server-data";

export const dynamic = "force-dynamic";

type PreviewPageProps = {
  searchParams: Promise<{
    path?: string;
  }>;
};

type PreviewCategory = ReturnType<typeof getFilePresentation>["category"];

type PreviewData = {
  fileName: string;
  relativePath: string;
  parentPath: string;
  category: PreviewCategory;
  displayType: string;
  sizeBytes: number;
  rawUrl: string;
  textContent: string | null;
  highlightedCode: string | null;
};

export default async function PreviewPage({ searchParams }: PreviewPageProps) {
  const { path: requestedPath } = await searchParams;

  if (!requestedPath) {
    return <PreviewError message="No file was selected." />;
  }

  const relativePath = sanitizeRelativePath(requestedPath);

  if (!relativePath) {
    return <PreviewError message="This file path is invalid." />;
  }

  const data = await loadPreviewData(relativePath);

  if (!data) {
    return (
      <PreviewError message="This file could not be opened or no longer exists." />
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-5 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-col gap-4 border-b border-zinc-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link
              href={createFilesUrl(data.parentPath)}
              className="mb-3 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-100"
            >
              <ArrowLeft size={16} />
              Back to folder
            </Link>

            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400">
                <PreviewIcon category={data.category} />
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-100">
                  {data.fileName}
                </h1>

                <p className="mt-1 text-sm text-zinc-500">
                  {data.displayType} · {formatBytes(data.sizeBytes)}
                </p>
              </div>
            </div>
          </div>

          <a
            href={`/api/files/share?path=${encodeURIComponent(
              data.relativePath,
            )}`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
          >
            <Download size={16} />
            Download
          </a>
        </header>

        <section className="min-h-[65vh] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <PreviewContent
            category={data.category}
            rawUrl={data.rawUrl}
            fileName={data.fileName}
            textContent={data.textContent}
            highlightedCode={data.highlightedCode}
          />
        </section>
      </div>
    </main>
  );
}

async function loadPreviewData(
  relativePath: string,
): Promise<PreviewData | null> {
  try {
    const absolutePath = await resolveConnorHubPath(relativePath);
    const fileStats = await stat(absolutePath);

    if (fileStats.isDirectory()) {
      return null;
    }

    const fileName = path.basename(absolutePath);
    const presentation = getFilePresentation(fileName, false);

    const shouldLoadText =
      presentation.category === "code" || presentation.category === "document";

    const textContent = shouldLoadText
      ? await readPreviewText(absolutePath, fileStats.size)
      : null;

    const highlightedCode =
      presentation.category === "code" && textContent
        ? await highlightCode(textContent, fileName)
        : null;

    return {
      fileName,
      relativePath,
      parentPath: getParentPath(relativePath),
      category: presentation.category,
      displayType: presentation.label,
      sizeBytes: fileStats.size,
      rawUrl: `/api/files/raw?path=${encodeURIComponent(relativePath)}`,
      textContent,
      highlightedCode,
    };
  } catch (error) {
    console.error("Unable to load preview:", error);
    return null;
  }
}

async function readPreviewText(
  absolutePath: string,
  sizeBytes: number,
): Promise<string> {
  const maxPreviewBytes = 1_000_000;

  if (sizeBytes > maxPreviewBytes) {
    return [
      "This file is too large to preview as text.",
      "",
      `Maximum preview size: ${formatBytes(maxPreviewBytes)}`,
      `File size: ${formatBytes(sizeBytes)}`,
    ].join("\n");
  }

  return readFile(absolutePath, "utf8");
}

async function highlightCode(
  source: string,
  fileName: string,
): Promise<string> {
  try {
    return await codeToHtml(source, {
      lang: getShikiLanguage(fileName),
      theme: "github-dark",
    });
  } catch (error) {
    console.error("Unable to highlight source file:", error);

    return await codeToHtml(source, {
      lang: "text",
      theme: "github-dark",
    });
  }
}

function getShikiLanguage(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();

  const languages: Record<string, string> = {
    ".js": "javascript",
    ".jsx": "jsx",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".json": "json",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".java": "java",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".hpp": "cpp",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
    ".php": "php",
    ".sh": "bash",
    ".sql": "sql",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
  };

  return languages[extension] ?? "text";
}

function PreviewContent({
  category,
  rawUrl,
  fileName,
  textContent,
  highlightedCode,
}: {
  category: PreviewCategory;
  rawUrl: string;
  fileName: string;
  textContent: string | null;
  highlightedCode: string | null;
}) {
  switch (category) {
    case "image":
      return (
        <div className="flex min-h-[65vh] items-center justify-center bg-zinc-950/60 p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={rawUrl}
            alt={fileName}
            className="max-h-[75vh] max-w-full rounded-lg object-contain"
          />
        </div>
      );

    case "pdf":
      return (
        <iframe
          src={rawUrl}
          title={fileName}
          className="min-h-[75vh] w-full bg-white"
        />
      );

    case "video":
      return (
        <div className="flex min-h-[65vh] items-center justify-center bg-black p-4">
          <video
            src={rawUrl}
            controls
            preload="metadata"
            className="max-h-[75vh] max-w-full"
          >
            Your browser does not support video playback.
          </video>
        </div>
      );

    case "audio":
      return (
        <div className="flex min-h-[65vh] items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <FileAudio size={42} className="mx-auto text-zinc-600" />

            <p className="mt-4 text-center text-sm font-medium text-zinc-300">
              {fileName}
            </p>

            <audio
              src={rawUrl}
              controls
              preload="metadata"
              className="mt-6 w-full"
            >
              Your browser does not support audio playback.
            </audio>
          </div>
        </div>
      );

    case "document":
      if (fileName.toLowerCase().endsWith(".md")) {
        return (
          <div className="min-h-[65vh] bg-zinc-950">
            <div className="border-b border-zinc-800 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">
                Markdown preview
              </p>
            </div>

            <article className="prose prose-invert max-w-none px-6 py-5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {textContent ?? "This Markdown file could not be read."}
              </ReactMarkdown>
            </article>
          </div>
        );
      }

      return (
        <div className="min-h-[65vh] bg-zinc-950">
          <div className="border-b border-zinc-800 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">
              Text preview
            </p>
          </div>

          <pre className="max-h-[75vh] overflow-auto whitespace-pre-wrap break-words px-5 py-4 font-mono text-sm leading-6 text-zinc-300">
            <code>{textContent ?? "This file could not be read as text."}</code>
          </pre>
        </div>
      );

    case "code":
      return (
        <div className="min-h-[65vh] bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">
              Source preview
            </p>

            <p className="text-xs text-zinc-600">
              {getShikiLanguage(fileName)}
            </p>
          </div>

          {highlightedCode ? (
            <div
              className="max-h-[75vh] overflow-auto [&_pre]:min-h-[65vh] [&_pre]:overflow-x-auto [&_pre]:p-5 [&_pre]:text-sm [&_pre]:leading-6"
              dangerouslySetInnerHTML={{
                __html: highlightedCode,
              }}
            />
          ) : (
            <pre className="max-h-[75vh] overflow-auto p-5 font-mono text-sm leading-6 text-zinc-300">
              <code>
                {textContent ?? "This source file could not be read."}
              </code>
            </pre>
          )}
        </div>
      );

    default:
      return (
        <PreviewPlaceholder
          icon={<File size={42} />}
          title="Preview unavailable"
          description="ConnorHub does not currently support previewing this file type. You can still download it."
        />
      );
  }
}

function PreviewPlaceholder({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[65vh] items-center justify-center px-6 py-12 text-center">
      <div>
        <div className="flex justify-center text-zinc-700">{icon}</div>

        <h2 className="mt-4 text-base font-medium text-zinc-300">{title}</h2>

        <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600">
          {description}
        </p>
      </div>
    </div>
  );
}

function PreviewIcon({ category }: { category: PreviewCategory }) {
  switch (category) {
    case "image":
      return <FileImage size={21} />;

    case "video":
      return <FileVideo size={21} />;

    case "audio":
      return <FileAudio size={21} />;

    case "pdf":
    case "document":
    case "code":
      return <FileText size={21} />;

    default:
      return <File size={21} />;
  }
}

function PreviewError({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
        <File size={38} className="mx-auto text-zinc-700" />

        <h1 className="mt-4 text-xl font-semibold">Preview unavailable</h1>

        <p className="mt-2 text-sm leading-6 text-zinc-500">{message}</p>

        <Link
          href="/files"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-zinc-100 px-4 text-sm font-medium text-zinc-950 transition hover:bg-white"
        >
          Return to Files
        </Link>
      </section>
    </main>
  );
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

function getParentPath(relativePath: string): string {
  return relativePath.split("/").filter(Boolean).slice(0, -1).join("/");
}

function createFilesUrl(relativePath: string): string {
  return relativePath
    ? `/files?path=${encodeURIComponent(relativePath)}`
    : "/files";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];

  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
