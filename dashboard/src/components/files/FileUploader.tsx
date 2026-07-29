"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type FileUploaderProps = {
  currentPath: string;
};

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; fileName: string }
  | { status: "success"; fileName: string }
  | { status: "error"; message: string };

export default function FileUploader({ currentPath }: FileUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({
    status: "idle",
  });

  const isUploading = uploadState.status === "uploading";

  function openFilePicker() {
    if (isUploading) {
      return;
    }

    inputRef.current?.click();
  }

  async function handleSelectedFiles(files: FileList | File[]): Promise<void> {
    const file = files[0];

    if (!file) {
      return;
    }

    await uploadFile(file);
  }

  async function uploadFile(file: File): Promise<void> {
    setUploadState({
      status: "uploading",
      fileName: file.name,
    });

    const formData = new FormData();

    formData.append("path", currentPath);
    formData.append("file", file);

    try {
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(getUploadError(result));
      }

      setUploadState({
        status: "success",
        fileName: file.name,
      });

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      router.refresh();
    } catch (error) {
      console.error("ConnorHub upload failed:", error);

      setUploadState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The file could not be uploaded.",
      });
    }
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (!isUploading) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDragging(false);
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (isUploading) {
      return;
    }

    await handleSelectedFiles(event.dataTransfer.files);
  }

  return (
    <div className="mb-5">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        disabled={isUploading}
        onChange={(event) => {
          void handleSelectedFiles(event.target.files ?? []);
        }}
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={(event) => {
          void handleDrop(event);
        }}
        className={`rounded-2xl border border-dashed p-5 transition ${
          isDragging
            ? "border-zinc-400 bg-zinc-800/80"
            : "border-zinc-700 bg-zinc-900"
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">
              Upload to {currentPath || "ConnorHub"}
            </p>

            <p className="mt-1 text-sm text-zinc-500">
              Drag a file here or select one from your device.
            </p>
          </div>

          <button
            type="button"
            disabled={isUploading}
            onClick={openFilePicker}
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? "Uploading…" : "Choose file"}
          </button>
        </div>

        {uploadState.status === "uploading" && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-4 text-sm">
              <span className="truncate text-zinc-300">
                Uploading {uploadState.fileName}
              </span>

              <span className="shrink-0 text-zinc-500">Please wait</span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-zinc-100" />
            </div>
          </div>
        )}

        {uploadState.status === "success" && (
          <p className="mt-4 text-sm text-emerald-400">
            Uploaded {uploadState.fileName}.
          </p>
        )}

        {uploadState.status === "error" && (
          <p className="mt-4 text-sm text-red-300">{uploadState.message}</p>
        )}
      </div>
    </div>
  );
}

function getUploadError(result: unknown): string {
  if (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof result.error === "string"
  ) {
    return result.error;
  }

  return "The file could not be uploaded.";
}
