import Link from "next/link";
import { ArrowLeft, File, Folder, HardDrive } from "lucide-react";

import { analyzeConnorHubStorage } from "@/lib/storage-analyzer";

export const dynamic = "force-dynamic";

export default async function StorageAnalyzerPage() {
  const analysis = await analyzeConnorHubStorage();

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-5 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 border-b border-zinc-800 pb-5">
          <Link
            href="/tools"
            className="mb-3 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-100"
          >
            <ArrowLeft size={16} />
            Back to Tools
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400">
              <HardDrive size={20} />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Storage Analyzer
              </h1>

              <p className="mt-1 text-sm text-zinc-500">
                See what is using space inside ConnorHub.
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Stored Data"
            value={formatBytes(analysis.totalSizeBytes)}
          />

          <StatCard
            label="Files"
            value={analysis.totalFiles.toLocaleString()}
          />

          <StatCard
            label="Folders"
            value={analysis.totalFolders.toLocaleString()}
          />
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-zinc-400">File Types</h2>

          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            {analysis.fileTypeBreakdown.map((type) => (
              <div
                key={type.category}
                className="border-b border-zinc-800 px-4 py-3 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      {type.category}
                    </p>

                    <p className="mt-0.5 text-xs text-zinc-600">
                      {type.fileCount.toLocaleString()} files
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-zinc-300">
                      {formatBytes(type.sizeBytes)}
                    </p>

                    <p className="mt-0.5 text-xs text-zinc-600">
                      {type.percentage.toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-zinc-500"
                    style={{
                      width: `${Math.max(
                        type.percentage,
                        type.percentage > 0 ? 1 : 0,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 text-sm font-medium text-zinc-400">
              Largest Folders
            </h2>

            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
              {analysis.largestFolders.map((folder) => (
                <Link
                  key={folder.relativePath}
                  href={`/files?path=${encodeURIComponent(folder.relativePath)}`}
                  className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3 transition hover:bg-zinc-800/60 last:border-b-0"
                >
                  <Folder size={17} className="shrink-0 text-zinc-500" />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-200">
                      {folder.name}
                    </p>

                    <p className="truncate text-xs text-zinc-600">
                      {folder.relativePath}
                    </p>
                  </div>

                  <span className="shrink-0 text-sm text-zinc-400">
                    {formatBytes(folder.sizeBytes)}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium text-zinc-400">
              Largest Files
            </h2>

            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
              {analysis.largestFiles.map((file) => (
                <Link
                  key={file.relativePath}
                  href={`/preview?path=${encodeURIComponent(file.relativePath)}`}
                  className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3 transition hover:bg-zinc-800/60 last:border-b-0"
                >
                  <File size={17} className="shrink-0 text-zinc-500" />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-200">
                      {file.name}
                    </p>

                    <p className="truncate text-xs text-zinc-600">
                      {file.relativePath}
                    </p>
                  </div>

                  <span className="shrink-0 text-sm text-zinc-400">
                    {formatBytes(file.sizeBytes)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-600">
        {label}
      </p>

      <p className="mt-2 text-xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];

  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  const value = bytes / 1024 ** index;

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
