import Link from "next/link";
import {
  formatBytes,
  formatRelativeTime,
  getDirectoryContents,
  getRecentFiles,
  getStorageInfo,
} from "@/lib/server-data";
import type { FileBrowserItem } from "@/types/files";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [storage, recentFiles, quickAccessResult] = await Promise.all([
    getStorageInfo(),
    getRecentFiles(),
    getDirectoryContents("")
      .then((items) => ({
        items,
        error: null,
      }))
      .catch((error: unknown) => {
        console.error("Unable to load ConnorHub root directory:", error);

        return {
          items: [] as FileBrowserItem[],
          error: "The ConnorHub root directory could not be loaded.",
        };
      }),
  ]);

  let quickAccessItems = quickAccessResult.items;
  let quickAccessError = quickAccessResult.error;

  try {
    quickAccessItems = await getDirectoryContents("");
  } catch (error) {
    console.error("Unable to load ConnorHub root directory:", error);
    quickAccessError = "The ConnorHub root directory could not be loaded.";
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-8 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10 flex flex-col gap-4 border-b border-zinc-800 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
              Personal infrastructure
            </p>

            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              ConnorHub
            </h1>

            <p className="mt-3 max-w-2xl text-zinc-400">
              Secure file transfer, active storage, and device monitoring from
              your Raspberry Pi.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-emerald-900 bg-emerald-950/50 px-4 py-2 text-sm text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Dashboard online
          </div>
        </header>

        <section className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Storage used"
            value={storage ? formatBytes(storage.usedBytes) : "Unavailable"}
            detail={
              storage
                ? `${formatBytes(storage.freeBytes)} free`
                : "Storage path unavailable"
            }
          />

          <StatCard
            label="Storage capacity"
            value={storage ? formatBytes(storage.totalBytes) : "Unavailable"}
            detail={
              storage ? `${storage.usedPercent}% used` : "Check configuration"
            }
          />

          <StatCard
            label="Recent items"
            value={String(recentFiles.length)}
            detail="Latest server activity"
          />

          <StatCard
            label="Server location"
            value="Raspberry Pi"
            detail="Connected through Tailscale"
          />
        </section>

        {storage && (
          <section className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-medium">Storage usage</p>
              <p className="text-sm text-zinc-500">{storage.usedPercent}%</p>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-zinc-100 transition-all"
                style={{
                  width: `${Math.min(storage.usedPercent, 100)}%`,
                }}
              />
            </div>
          </section>
        )}

        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <section>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Quick access</h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Browse the main ConnorHub storage areas.
                </p>
              </div>

              <Link
                href="/files"
                className="shrink-0 text-sm font-medium text-zinc-400 transition hover:text-zinc-100"
              >
                Browse all files →
              </Link>
            </div>

            {quickAccessError ? (
              <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-6 text-sm text-red-300">
                {quickAccessError}
              </div>
            ) : quickAccessItems.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-500">
                No files or folders were found in ConnorHub storage.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {quickAccessItems.map((item) => (
                  <Link
                    key={item.relativePath}
                    href={createItemUrl(item)}
                    className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-700 hover:bg-zinc-800/80"
                  >
                    <div className="mb-8 flex items-start justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-xl transition group-hover:bg-zinc-700">
                        {item.isDirectory ? "📁" : "📄"}
                      </div>

                      <span className="text-zinc-600 transition group-hover:text-zinc-300">
                        →
                      </span>
                    </div>

                    <h3 className="truncate font-semibold">{item.name}</h3>

                    <p className="mt-1 text-sm leading-6 text-zinc-500">
                      {item.isDirectory
                        ? "Folder"
                        : formatBytes(item.sizeBytes)}
                    </p>

                    <p className="mt-2 text-xs text-zinc-600">
                      Modified {formatRelativeTime(item.modifiedAt)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <aside>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Recent activity</h2>

              <p className="mt-1 text-sm text-zinc-500">
                Latest changes across the server.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
              {recentFiles.length === 0 ? (
                <div className="p-6 text-sm text-zinc-500">
                  No files were found. Confirm that the dashboard can access the
                  ConnorHub storage folder.
                </div>
              ) : (
                recentFiles.map((file, index) => (
                  <Link
                    key={file.relativePath}
                    href={createItemUrl(file)}
                    className={`block p-5 transition hover:bg-zinc-800/70 ${
                      index !== recentFiles.length - 1
                        ? "border-b border-zinc-800"
                        : ""
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                        {file.isDirectory ? "📁" : "📄"}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-medium">{file.name}</p>

                        <p className="mt-1 text-sm text-zinc-500">
                          {file.location} ·{" "}
                          {formatRelativeTime(file.modifiedAt)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
};

function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-zinc-600">{detail}</p>
    </article>
  );
}

type NavigableItem = {
  relativePath: string;
  isDirectory: boolean;
};

function createItemUrl(item: NavigableItem): string {
  return item.isDirectory
    ? createFilesUrl(item.relativePath)
    : createPreviewUrl(item.relativePath);
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
