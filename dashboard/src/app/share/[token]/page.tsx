import { Download, File, FolderArchive } from "lucide-react";
import { stat } from "node:fs/promises";
import path from "node:path";

import { resolveConnorHubPath } from "@/lib/server-data";
import { getShareToken } from "@/lib/share-tokens";

export const dynamic = "force-dynamic";

type SharePageProps = {
  params: Promise<{
    token: string;
  }>;
};

type SharePageData = {
  token: string;
  isDirectory: boolean;
  itemName: string;
  downloadName: string;
  expiresAt: string;
  sizeBytes: number;
};

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  const data = await loadSharePageData(token);

  if (!data) {
    return <ExpiredShare />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10 text-zinc-100">
      <section className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <header className="border-b border-zinc-800 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600">
            ConnorHub Share
          </p>

          <h1 className="mt-2 break-words text-xl font-semibold text-zinc-100">
            {data.downloadName}
          </h1>
        </header>

        <div className="p-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-300">
            {data.isDirectory ? (
              <FolderArchive size={30} />
            ) : (
              <File size={30} />
            )}
          </div>

          <div className="mt-5 space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <ShareDetail
              label="Type"
              value={data.isDirectory ? "Folder ZIP" : "File"}
            />

            {!data.isDirectory && (
              <ShareDetail label="Size" value={formatBytes(data.sizeBytes)} />
            )}

            <ShareDetail
              label="Expires"
              value={formatExpiration(data.expiresAt)}
            />
          </div>

          <p className="mt-5 text-sm leading-6 text-zinc-500">
            {data.isDirectory
              ? "This folder will be packaged as a ZIP archive when you download it."
              : "This file is ready to download from ConnorHub."}
          </p>

          <a
            href={`/api/share/${encodeURIComponent(data.token)}/download`}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-white"
          >
            <Download size={17} />
            {data.isDirectory ? "Download ZIP" : "Download File"}
          </a>

          <p className="mt-4 text-center text-xs text-zinc-600">
            Shared securely through ConnorHub.
          </p>
        </div>
      </section>
    </main>
  );
}

async function loadSharePageData(token: string): Promise<SharePageData | null> {
  try {
    const record = await getShareToken(token);

    if (!record) {
      return null;
    }

    const absolutePath = await resolveConnorHubPath(record.relativePath);
    const itemStats = await stat(absolutePath);

    const isDirectory = itemStats.isDirectory();
    const itemName = path.basename(absolutePath);

    return {
      token,
      isDirectory,
      itemName,
      downloadName: isDirectory ? `${itemName}.zip` : itemName,
      expiresAt: record.expiresAt,
      sizeBytes: itemStats.size,
    };
  } catch (error) {
    console.error("Unable to load shared ConnorHub item:", error);
    return null;
  }
}

function ExpiredShare() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
        <h1 className="text-xl font-semibold">Share unavailable</h1>

        <p className="mt-2 text-sm leading-6 text-zinc-500">
          This share has expired, was removed, or the original item no longer
          exists.
        </p>
      </section>
    </main>
  );
}

function ShareDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-zinc-600">{label}</span>
      <span className="text-right text-sm font-medium text-zinc-300">
        {value}
      </span>
    </div>
  );
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

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function formatExpiration(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(value));
}
