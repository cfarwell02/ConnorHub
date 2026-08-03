"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

type RenameFileDialogProps = {
  itemName: string;
  relativePath: string;
  isDirectory: boolean;
  isOpen: boolean;
  onClose: () => void;
};

export default function RenameFileDialog({
  itemName,
  relativePath,
  isDirectory,
  isOpen,
  onClose,
}: RenameFileDialogProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [newName, setNewName] = useState(itemName);
  const [isRenaming, setIsRenaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const closeModal = useCallback(() => {
    if (isRenaming) {
      return;
    }

    setNewName(itemName);
    setErrorMessage(null);
    onClose();
  }, [isRenaming, itemName, onClose]);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();

    const trimmedName = newName.trim();

    if (!trimmedName) {
      setErrorMessage("Enter a new name.");
      return;
    }

    if (trimmedName === itemName) {
      return;
    }

    setIsRenaming(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/files/rename", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: relativePath,
          newName: trimmedName,
        }),
      });

      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(getRenameError(result));
      }

      onClose();
      router.refresh();
    } catch (error) {
      console.error("ConnorHub rename failed:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The item could not be renamed.",
      );
    } finally {
      setIsRenaming(false);
    }
  }

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4"
      onMouseDown={(event) => {
        event.stopPropagation();

        if (event.target === event.currentTarget) {
          closeModal();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-item-title"
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2
          id="rename-item-title"
          className="text-xl font-semibold text-zinc-100"
        >
          Rename {isDirectory ? "folder" : "file"}
        </h2>

        <p className="mt-2 text-sm text-zinc-500">
          Enter a new name for {itemName}.
        </p>

        <form onSubmit={handleSubmit} className="mt-6">
          <label
            htmlFor={`rename-${relativePath}`}
            className="block text-sm font-medium text-zinc-300"
          >
            New name
          </label>

          <input
            ref={inputRef}
            id={`rename-${relativePath}`}
            type="text"
            value={newName}
            disabled={isRenaming}
            onChange={(event) => {
              setNewName(event.target.value);

              if (errorMessage) {
                setErrorMessage(null);
              }
            }}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
          />

          {errorMessage && (
            <p className="mt-3 text-sm text-red-300">{errorMessage}</p>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              disabled={isRenaming}
              onClick={closeModal}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                isRenaming ||
                newName.trim().length === 0 ||
                newName.trim() === itemName
              }
              className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRenaming ? "Renaming…" : "Rename"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function getRenameError(result: unknown): string {
  if (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof result.error === "string"
  ) {
    return result.error;
  }

  return "The item could not be renamed.";
}
