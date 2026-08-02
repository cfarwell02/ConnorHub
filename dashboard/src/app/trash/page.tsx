import Link from "next/link";
import { Trash2 } from "lucide-react";

import { CONNORHUB_ROOT } from "@/lib/server-data";
import { readFile } from "node:fs/promises";
import path from "node:path";

type TrashRecord = {
  id: string;
  originalPath: string;
  trashPath: string;
  deletedAt: string;
};

const TRASH_INDEX = path.join(
  CONNORHUB_ROOT,
  ".connorhub",
  "trash",
  "index.json",
);

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const records = await readTrashRecords();

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-5 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 border-b border-zinc-800 pb-5">
          <h1 className="text-2xl font-semibold tracking-tight">Trash</h1>

          <p className="mt-1 text-sm text-zinc-500">
            Restore items or delete them permanently.
          </p>
        </header>

        {records.length === 0 ? (
          <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/60 px-6 text-center">
            <Trash2 size={38} className="text-zinc-700" />

            <h2 className="mt-4 text-base font-medium text-zinc-300">
              Trash is empty
            </h2>

            <p className="mt-1 text-sm text-zinc-600">
              Items moved to Trash will appear here.
            </p>
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            <div className="grid grid-cols-[minmax(0,1fr)_180px_160px] border-b border-zinc-800 px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-600">
              <span>Name</span>
              <span>Original location</span>
              <span className="text-right">Deleted</span>
            </div>

            <div className="divide-y divide-zinc-800/80">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="grid grid-cols-[minmax(0,1fr)_180px_160px] items-center px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-200">
                      {getItemName(record.originalPath)}
                    </p>
                  </div>

                  <p className="truncate text-sm text-zinc-500">
                    {getParentPath(record.originalPath)}
                  </p>

                  <p className="text-right text-sm text-zinc-500">
                    {new Date(record.deletedAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <Link
          href="/files"
          className="mt-5 inline-block text-sm text-zinc-500 transition hover:text-zinc-200"
        >
          ← Back to files
        </Link>
      </div>
    </main>
  );
}

async function readTrashRecords(): Promise<TrashRecord[]> {
  try {
    const contents = await readFile(TRASH_INDEX, "utf8");
    const records = JSON.parse(contents) as TrashRecord[];

    return records.sort(
      (a, b) =>
        new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime(),
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function getItemName(relativePath: string): string {
  return relativePath.split("/").filter(Boolean).at(-1) ?? relativePath;
}

function getParentPath(relativePath: string): string {
  const segments = relativePath.split("/").filter(Boolean);
  segments.pop();

  return segments.length > 0 ? segments.join("/") : "ConnorHub";
}
