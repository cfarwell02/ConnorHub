"use client";

import { useState, useTransition } from "react";
import { FolderInput, X } from "lucide-react";
import { useRouter } from "next/navigation";

type MoveFileDialogProps = {
  itemName: string;
  sourcePaths: string[];
  isOpen: boolean;
  onClose: () => void;
};

export default function MoveFileDialog({
  itemName,
  sourcePaths,
  isOpen,
  onClose,
}: MoveFileDialogProps) {
  const router = useRouter();
  const [destinationFolder, setDestinationFolder] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    setDestinationFolder("");
    setErrorMessage(null);
    onClose();
  }

  if (!isOpen) {
    return null;
  }

  function handleMove() {
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/files/move-many", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourcePaths,
            destinationFolder,
          }),
        });

        const result = (await response.json()) as {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(result.error ?? "The item could not be moved.");
        }

        handleClose();
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The item could not be moved.",
        );
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4"
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="flex items-start justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 className="font-semibold text-zinc-100">Move “{itemName}”</h2>

            <p className="mt-1 text-sm text-zinc-500">
              Enter the destination folder relative to ConnorHub.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close move dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="mb-2 block text-sm text-zinc-400">
              Destination folder
            </span>

            <input
              type="text"
              value={destinationFolder}
              onChange={(event) => setDestinationFolder(event.target.value)}
              placeholder="Projects/Archive"
              className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500"
            />
          </label>

          {errorMessage && (
            <p className="text-sm text-red-300">{errorMessage}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={handleMove}
            className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:opacity-50"
          >
            <FolderInput size={16} />
            {isPending ? "Moving..." : "Move"}
          </button>
        </div>
      </div>
    </div>
  );
}
