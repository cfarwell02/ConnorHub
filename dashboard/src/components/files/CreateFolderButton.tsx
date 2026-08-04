"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type CreateFolderButtonProps = {
  currentPath: string;
};

export default function CreateFolderButton({
  currentPath,
}: CreateFolderButtonProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const closeModal = useCallback(() => {
    if (isCreating) {
      return;
    }

    setIsOpen(false);
    setFolderName("");
    setErrorMessage(null);
  }, [isCreating]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    inputRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isCreating) {
        closeModal();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isCreating, closeModal]);

  function openModal() {
    setFolderName("");
    setErrorMessage(null);
    setIsOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedFolderName = folderName.trim();

    if (!trimmedFolderName) {
      setErrorMessage("Enter a folder name.");
      return;
    }

    setIsCreating(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/files/create-folder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: currentPath,
          name: trimmedFolderName,
        }),
      });

      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(getCreateFolderError(result));
      }

      setIsOpen(false);
      setFolderName("");
      router.refresh();
    } catch (error) {
      console.error("ConnorHub folder creation failed:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The folder could not be created.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800"
      >
        New folder
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-folder-title"
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
          >
            <div>
              <h2
                id="create-folder-title"
                className="text-xl font-semibold text-zinc-100"
              >
                Create folder
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Create a new folder inside {currentPath || "ConnorHub"}.
              </p>
            </div>

            <form
              onSubmit={(event) => {
                void handleSubmit(event);
              }}
              className="mt-6"
            >
              <label
                htmlFor="folder-name"
                className="block text-sm font-medium text-zinc-300"
              >
                Folder name
              </label>

              <input
                ref={inputRef}
                id="folder-name"
                type="text"
                value={folderName}
                disabled={isCreating}
                onChange={(event) => {
                  setFolderName(event.target.value);

                  if (errorMessage) {
                    setErrorMessage(null);
                  }
                }}
                placeholder="Example: CS 120"
                className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
              />

              {errorMessage && (
                <p className="mt-3 text-sm text-red-300">{errorMessage}</p>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={closeModal}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isCreating || folderName.trim().length === 0}
                  className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function getCreateFolderError(result: unknown): string {
  if (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof result.error === "string"
  ) {
    return result.error;
  }

  return "The folder could not be created.";
}
