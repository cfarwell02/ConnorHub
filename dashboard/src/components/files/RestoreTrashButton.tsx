"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";

type RestoreTrashButtonProps = {
  recordId: string;
  itemName: string;
};

export default function RestoreTrashButton({
  recordId,
  itemName,
}: RestoreTrashButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleRestore() {
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/files/trash/restore", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: recordId,
          }),
        });

        const result = (await response.json()) as {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            result.error ?? `"${itemName}" could not be restored.`,
          );
        }

        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : `"${itemName}" could not be restored.`,
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={handleRestore}
        className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
      >
        <RotateCcw size={15} />
        {isPending ? "Restoring..." : "Restore"}
      </button>

      {errorMessage && (
        <p className="max-w-64 text-right text-xs text-red-300">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
