"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DeleteFileButtonProps = {
  itemName: string;
  relativePath: string;
  isDirectory: boolean;
};

export default function DeleteFileButton({
  itemName,
  relativePath,
  isDirectory,
}: DeleteFileButtonProps) {
  const router = useRouter();

  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDelete(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const itemType = isDirectory ? "folder" : "file";

    const confirmed = window.confirm(
      `Delete the ${itemType} "${itemName}"? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/files/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: relativePath,
        }),
      });

      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(getDeleteError(result));
      }

      router.refresh();
    } catch (error) {
      console.error("ConnorHub delete failed:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The item could not be deleted.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isDeleting}
        onClick={(event) => {
          void handleDelete(event);
        }}
        className="rounded-lg border border-red-900/70 px-2 py-2 text-xs font-medium text-red-300 transition hover:border-red-700 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
      >
        {isDeleting ? "Deleting…" : "Delete"}
      </button>

      {errorMessage && (
        <p className="max-w-48 text-right text-xs text-red-300">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

function getDeleteError(result: unknown): string {
  if (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof result.error === "string"
  ) {
    return result.error;
  }

  return "The item could not be deleted.";
}
