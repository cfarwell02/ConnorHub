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
  downloadName: string;
  expiresAt: string;
};

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  const data = await loadSharePageData(token);

  if (!data) {
    return <ExpiredShare />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10 text-zinc-100">
      <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
          {data.isDirectory ? <FolderArchive size={27} /> : <File size={27} />}
        </div>

        <h1 className="mt-5 break-words text-xl font-semibold">
          {data.downloadName}
        </h1>

        <p className="mt-2 text-sm leading-6 text-zinc-500">
          {data.isDirectory
            ? "This folder will be downloaded as a ZIP archive."
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
          This temporary share expires{" "}
          {new Date(data.expiresAt).toLocaleString()}.
        </p>
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
      downloadName: isDirectory ? `${itemName}.zip` : itemName,
      expiresAt: record.expiresAt,
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
