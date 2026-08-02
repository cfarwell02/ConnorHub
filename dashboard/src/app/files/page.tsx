import Link from "next/link";
import { getDirectoryContents } from "@/lib/server-data";
import type { FileBrowserItem } from "@/types/files";
import FileUploader from "@/components/files/FileUploader";
import FileExplorer from "@/components/files/FileExplorer";
import CreateFolderButton from "@/components/files/CreateFolderButton";
import { getPinnedPaths } from "@/lib/file-metadata";

export const dynamic = "force-dynamic";

type FilesPageProps = {
  searchParams: Promise<{
    path?: string;
  }>;
};

export default async function FilesPage({ searchParams }: FilesPageProps) {
  const { path: requestedPath = "" } = await searchParams;
  const currentPath = sanitizeDisplayPath(requestedPath);

  let items: FileBrowserItem[] = [];
  let pinnedPaths: string[] = [];
  let errorMessage: string | null = null;

  try {
    [items, pinnedPaths] = await Promise.all([
      getDirectoryContents(currentPath),
      getPinnedPaths(),
    ]);

    console.log("Pinned paths loaded:", pinnedPaths);
  } catch (error) {
    console.error("Unable to browse ConnorHub directory:", error);
    errorMessage = "This folder could not be opened.";
  }

  const breadcrumbs = buildBreadcrumbs(currentPath);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-5 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-col gap-4 border-b border-zinc-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">All Files</h1>

            <p className="mt-1 text-sm text-zinc-500">
              Browse and manage ConnorHub storage.
            </p>
          </div>

          <CreateFolderButton currentPath={currentPath} />
        </header>

        <div className="mb-4 flex min-h-11 items-center rounded-xl border border-zinc-800 bg-zinc-900 px-4">
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 flex-wrap items-center gap-2 text-sm"
          >
            {breadcrumbs.map((breadcrumb, index) => {
              const isCurrent = index === breadcrumbs.length - 1;

              return (
                <div
                  key={breadcrumb.path}
                  className="flex min-w-0 items-center gap-2"
                >
                  {index > 0 && (
                    <span className="shrink-0 text-zinc-700">›</span>
                  )}

                  {isCurrent ? (
                    <span
                      aria-current="page"
                      className="truncate font-medium text-zinc-200"
                    >
                      {breadcrumb.name}
                    </span>
                  ) : (
                    <Link
                      href={createFilesUrl(breadcrumb.path)}
                      className="truncate text-zinc-500 transition hover:text-zinc-100"
                    >
                      {breadcrumb.name}
                    </Link>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        <FileUploader currentPath={currentPath} />

        {errorMessage ? (
          <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-6 text-sm text-red-300">
            {errorMessage}
          </div>
        ) : (
          <FileExplorer items={items} pinnedPaths={pinnedPaths} />
        )}
      </div>
    </main>
  );
}

function sanitizeDisplayPath(value: string): string {
  return value
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");
}

function createFilesUrl(relativePath: string): string {
  if (!relativePath) {
    return "/files";
  }

  return `/files?path=${encodeURIComponent(relativePath)}`;
}

function buildBreadcrumbs(relativePath: string) {
  const segments = relativePath.split("/").filter(Boolean);

  return [
    {
      name: "ConnorHub",
      path: "",
    },
    ...segments.map((segment, index) => ({
      name: segment,
      path: segments.slice(0, index + 1).join("/"),
    })),
  ];
}
