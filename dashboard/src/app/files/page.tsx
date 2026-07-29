import Link from "next/link";
import {
  formatBytes,
  getDirectoryContents,
  type FileBrowserItem,
} from "@/lib/server-data";
import FileUploader from "@/components/files/FileUploader";
import DeleteFileButton from "@/components/files/DeleteFileButton";

export const dynamic = "force-dynamic";

const rowClassName =
  "grid grid-cols-[minmax(0,1fr)_80px_72px] items-center border-b border-zinc-800 px-4 py-4 transition last:border-b-0 hover:bg-zinc-800/70 sm:grid-cols-[minmax(0,1fr)_140px_180px_90px]";

type FilesPageProps = {
  searchParams: Promise<{
    path?: string;
  }>;
};

export default async function FilesPage({ searchParams }: FilesPageProps) {
  const { path: requestedPath = "" } = await searchParams;
  const currentPath = sanitizeDisplayPath(requestedPath);

  let items: FileBrowserItem[] = [];
  let errorMessage: string | null = null;

  try {
    items = await getDirectoryContents(currentPath);
  } catch (error) {
    console.error("Unable to browse ConnorHub directory:", error);
    errorMessage = "This folder could not be opened.";
  }

  const breadcrumbs = buildBreadcrumbs(currentPath);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-8 text-zinc-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 border-b border-zinc-800 pb-6">
          <Link
            href="/"
            className="text-sm text-zinc-500 transition hover:text-zinc-200"
          >
            ← Dashboard
          </Link>

          <div className="mt-5">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
              ConnorHub storage
            </p>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              Files
            </h1>
          </div>
        </header>

        <nav
          aria-label="Breadcrumb"
          className="mb-5 flex flex-wrap items-center gap-2 text-sm"
        >
          {breadcrumbs.map((breadcrumb, index) => (
            <div key={breadcrumb.path} className="flex items-center gap-2">
              {index > 0 && <span className="text-zinc-700">/</span>}

              <Link
                href={createFilesUrl(breadcrumb.path)}
                className="text-zinc-400 transition hover:text-zinc-100"
              >
                {breadcrumb.name}
              </Link>
            </div>
          ))}
        </nav>

        <FileUploader currentPath={currentPath} />

        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="grid grid-cols-[minmax(0,1fr)_80px_72px] border-b border-zinc-800 px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-600 sm:grid-cols-[minmax(0,1fr)_140px_180px_90px]">
            <span>Name</span>
            <span className="text-right">Size</span>
            <span className="hidden text-right sm:block">Last modified</span>
            <span className="text-right">Actions</span>
          </div>

          {errorMessage ? (
            <div className="p-6 text-sm text-red-300">{errorMessage}</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500">
              This folder is empty.
            </div>
          ) : (
            items.map((item) => {
              const content = (
                <>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                      {item.isDirectory ? "📁" : "📄"}
                    </span>

                    <span className="truncate font-medium">{item.name}</span>
                  </div>

                  <span className="text-right text-sm text-zinc-500">
                    {item.isDirectory ? "—" : formatBytes(item.sizeBytes)}
                  </span>

                  <span className="hidden text-right text-sm text-zinc-500 sm:block">
                    {item.modifiedAt.toLocaleString()}
                  </span>

                  <div className="flex justify-end">
                    <DeleteFileButton
                      itemName={item.name}
                      relativePath={item.relativePath}
                      isDirectory={item.isDirectory}
                    />
                  </div>
                </>
              );

              if (item.isDirectory) {
                return (
                  <Link
                    key={item.relativePath}
                    href={createFilesUrl(item.relativePath)}
                    className={rowClassName}
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <Link
                  key={item.relativePath}
                  href={createPreviewUrl(item.relativePath)}
                  className={rowClassName}
                >
                  {content}
                </Link>
              );
            })
          )}
        </section>
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

function createPreviewUrl(relativePath: string): string {
  return `/preview?path=${encodeURIComponent(relativePath)}`;
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
