"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function FileKeyboardShortcuts() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;

      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (isTyping) {
        return;
      }

      const isUndo =
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "z" &&
        !event.shiftKey;

      if (!isUndo || isPending) {
        return;
      }

      event.preventDefault();

      startTransition(async () => {
        try {
          const response = await fetch("/api/files/undo", {
            method: "POST",
          });

          const result = (await response.json()) as {
            error?: string;
          };

          if (!response.ok) {
            if (response.status !== 404) {
              console.error(result.error ?? "Undo failed.");
            }

            return;
          }

          router.refresh();
        } catch (error) {
          console.error("Undo failed:", error);
        }
      });
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPending, router]);

  return null;
}
