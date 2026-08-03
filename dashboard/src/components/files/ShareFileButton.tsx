"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";

type ShareFileButtonProps = {
  relativePath: string;
  itemName: string;
  isDirectory: boolean;
  onComplete?: () => void;
};

export default function ShareFileButton({
  relativePath,
  itemName,
  isDirectory,
  onComplete,
}: ShareFileButtonProps) {
  const [isPending, setIsPending] = useState(false);

  async function handleShare() {
    if (isDirectory || isPending) {
      return;
    }

    setIsPending(true);

    try {
      const downloadUrl = `/api/files/download?path=${encodeURIComponent(
        relativePath,
      )}`;

      const response = await fetch(downloadUrl);

      if (!response.ok) {
        throw new Error("The file could not be prepared for sharing.");
      }

      const blob = await response.blob();
      const file = new File([blob], itemName, {
        type: blob.type || "application/octet-stream",
      });

      const canShareFile =
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({
          files: [file],
        });

      if (canShareFile) {
        await navigator.share({
          title: itemName,
          files: [file],
        });
      } else if (typeof navigator.share === "function") {
        await navigator.share({
          title: itemName,
          url: new URL(downloadUrl, window.location.origin).toString(),
        });
      } else {
        const anchor = document.createElement("a");
        anchor.href = downloadUrl;
        anchor.download = itemName;
        anchor.click();
      }

      onComplete?.();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.error("Unable to share file:", error);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={isDirectory || isPending}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Share2 size={16} className="text-zinc-500" />

      <span>{isPending ? "Preparing…" : "Share"}</span>
    </button>
  );
}
