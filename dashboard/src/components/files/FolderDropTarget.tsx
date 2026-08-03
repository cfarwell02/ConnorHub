"use client";

import { type DragEvent, type ReactNode, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type FolderDropTargetProps = {
  destinationPath: string;
  children: ReactNode;
  onMoveComplete?: () => void;
};

export default function FolderDropTarget({
  destinationPath,
  children,
  onMoveComplete,
}: FolderDropTargetProps) {
  const router = useRouter();
  const [isOver, setIsOver] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    const hasConnorHubItems = Array.from(event.dataTransfer.types).includes(
      "application/x-connorhub-paths",
    );

    if (!hasConnorHubItems) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setIsOver(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsOver(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsOver(false);

    const rawPaths = event.dataTransfer.getData(
      "application/x-connorhub-paths",
    );

    if (!rawPaths) {
      return;
    }

    let sourcePaths: string[];

    try {
      sourcePaths = JSON.parse(rawPaths) as string[];
    } catch {
      console.error("Unable to read dragged ConnorHub paths.");
      return;
    }

    const validSourcePaths = sourcePaths.filter(
      (sourcePath): sourcePath is string =>
        typeof sourcePath === "string" && sourcePath.length > 0,
    );

    if (validSourcePaths.length === 0) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/files/move-many", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourcePaths: validSourcePaths,
            destinationFolder: destinationPath,
          }),
        });

        const result = (await response.json()) as {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            result.error ?? "The selected items could not be moved.",
          );
        }

        router.refresh();
        onMoveComplete?.();
      } catch (error) {
        console.error("Unable to move dropped items:", error);
      }
    });
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`transition ${
        isOver ? "rounded-lg bg-zinc-700/70 ring-2 ring-zinc-500" : ""
      } ${isPending ? "pointer-events-none opacity-60" : ""}`}
    >
      {children}
    </div>
  );
}
