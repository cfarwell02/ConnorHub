import Link from "next/link";
import path from "node:path";
import { getFileCategory } from "@/lib/file-types";

export const dynamic = "force-dynamic";

type PreviewPageProps = {
  searchParams: Promise<{
    path?: string;
  }>;
};

export default async function PreviewPage({ searchParams }: PreviewPageProps) {
  const { path: requestedPath } = await searchParams;

  if (!requestedPath) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold">No file selected</h1>

          <p className="mt-3 text-sm text-zinc-500">
            Return to Files and choose something to preview.
          </p>

          <Link
            href="/files"
            className="mt-6 inline-flex rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white"
          >
            Open Files
          </Link>
        </div>
      </main>
    );
  }

  const safePath = sanitizePreviewPath(requestedPath);
  const fileName = safePath.split("/").pop() ?? "File";
  const category = getFileCategory(fileName);
  const contentUrl = createContentUrl(safePath);
  const parentFolder = getParentFolder(safePath);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-5 text-zinc-100 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-col gap-4 border-b border-zinc-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link
              href={createFilesUrl(parentFolder)}
              className="text-sm text-zinc-500 transition hover:text-zinc-200"
            >
              ← Back to folder
            </Link>

            <h1 className="mt-3 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
              {fileName}
            </h1>

            <p className="mt-1 truncate text-sm text-zinc-500">{safePath}</p>
          </div>

          <a
            href={contentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium transition hover:border-zinc-500 hover:bg-zinc-900"
          >
            Open original
          </a>
        </header>

        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <FilePreview
            category={category}
            contentUrl={contentUrl}
            fileName={fileName}
          />
        </section>
      </div>
    </main>
  );
}

type FilePreviewProps = {
  category: ReturnType<typeof getFileCategory>;
  contentUrl: string;
  fileName: string;
};

function FilePreview({ category, contentUrl, fileName }: FilePreviewProps) {
  switch (category) {
    case "image":
      return (
        <div className="flex min-h-[70vh] items-center justify-center p-4 sm:p-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={contentUrl}
            alt={fileName}
            className="max-h-[80vh] max-w-full rounded-lg object-contain"
          />
        </div>
      );

    case "pdf":
      return (
        <iframe
          src={contentUrl}
          title={fileName}
          className="h-[82vh] w-full bg-white"
        />
      );

    case "text":
      return (
        <iframe
          src={contentUrl}
          title={fileName}
          className="h-[82vh] w-full bg-white"
        />
      );

    case "video":
      return (
        <div className="flex min-h-[70vh] items-center justify-center p-4 sm:p-8">
          <video
            src={contentUrl}
            controls
            playsInline
            className="max-h-[80vh] max-w-full rounded-lg"
          >
            Your browser does not support this video.
          </video>
        </div>
      );

    case "audio":
      return (
        <div className="flex min-h-[50vh] items-center justify-center p-6">
          <audio src={contentUrl} controls className="w-full max-w-xl">
            Your browser does not support this audio file.
          </audio>
        </div>
      );

    default:
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
          <div className="text-5xl">📄</div>

          <h2 className="mt-5 text-xl font-semibold">Preview unavailable</h2>

          <p className="mt-2 max-w-md text-sm text-zinc-500">
            ConnorHub cannot preview this file type yet, but you can open the
            original file in your browser.
          </p>

          <a
            href={contentUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-6 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white"
          >
            Open file
          </a>
        </div>
      );
  }
}

function sanitizePreviewPath(value: string): string {
  return value
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");
}

function createContentUrl(relativePath: string): string {
  return `/api/files/content?path=${encodeURIComponent(relativePath)}`;
}

function createFilesUrl(relativePath: string): string {
  if (!relativePath || relativePath === ".") {
    return "/files";
  }

  return `/files?path=${encodeURIComponent(relativePath)}`;
}

function getParentFolder(relativePath: string): string {
  const parent = path.posix.dirname(relativePath);

  return parent === "." ? "" : parent;
}
