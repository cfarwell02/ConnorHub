"use client";

import { type DragEvent, type ReactNode, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type FolderDropTargetProps = {
  destinationPath: string;
  children: ReactNode;
};

export default function FolderDropTarget({
  destinationPath,
  children,
}: FolderDropTargetProps) {
  const router = useRouter();
  const [isOver, setIsOver] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    const hasConnorHubItem = Array.from(event.dataTransfer.types).includes(
      "application/x-connorhub-path",
    );

    if (!hasConnorHubItem) {
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

    const sourcePath = event.dataTransfer.getData(
      "application/x-connorhub-path",
    );

    if (!sourcePath || sourcePath === destinationPath) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/files/move", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourcePath,
            destinationFolder: destinationPath,
          }),
        });

        const result = (await response.json()) as {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(result.error ?? "The item could not be moved.");
        }

        router.refresh();
      } catch (error) {
        console.error("Unable to move dropped item:", error);
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
