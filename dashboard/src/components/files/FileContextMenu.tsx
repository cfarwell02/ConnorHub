"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Pin, PinOff } from "lucide-react";

type FileContextMenuProps = {
  relativePath: string;
  initialPinned: boolean;
  children: React.ReactNode;
};

export default function FileContextMenu({
  relativePath,
  initialPinned,
  children,
}: FileContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(initialPinned);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    function handleAnotherMenuOpened(event: Event) {
      const customEvent = event as CustomEvent<string>;

      if (customEvent.detail !== menuId) {
        setIsOpen(false);
      }
    }

    window.addEventListener(
      "connorhub:context-menu-opened",
      handleAnotherMenuOpened,
    );

    return () => {
      window.removeEventListener(
        "connorhub:context-menu-opened",
        handleAnotherMenuOpened,
      );
    };
  }, [menuId]);

  useEffect(() => {
    function closeMenu() {
      setIsOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("click", closeMenu);
    window.addEventListener("blur", closeMenu);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("blur", closeMenu);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function handleContextMenu(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    window.dispatchEvent(
      new CustomEvent("connorhub:context-menu-opened", {
        detail: menuId,
      }),
    );

    const menuWidth = 220;
    const menuHeight = 52;

    setPosition({
      x: Math.min(event.clientX, window.innerWidth - menuWidth - 12),
      y: Math.min(event.clientY, window.innerHeight - menuHeight - 12),
    });

    setIsOpen(true);
  }

  function handleTogglePinned(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

    startTransition(async () => {
      const response = await fetch("/api/files/pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          relativePath,
        }),
      });

      if (!response.ok) {
        return;
      }

      const result = (await response.json()) as {
        pinned: boolean;
      };

      setIsPinned(result.pinned);
      setIsOpen(false);
    });
  }

  return (
    <div ref={containerRef} onContextMenu={handleContextMenu}>
      {children}

      {isOpen && (
        <div
          role="menu"
          className="fixed z-50 w-52 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-2xl shadow-black/40"
          style={{
            left: position.x,
            top: position.y,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            disabled={isPending}
            onClick={handleTogglePinned}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
          >
            {isPinned ? <PinOff size={16} /> : <Pin size={16} />}

            <span>
              {isPinned ? "Unpin from Quick Access" : "Pin to Quick Access"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
