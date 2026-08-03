"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useState,
  useTransition,
} from "react";
import {
  ExternalLink,
  FolderInput,
  Pin,
  PinOff,
  CopyPlus,
  Trash2,
  Pencil,
} from "lucide-react";
import MoveFileDialog from "@/components/files/MoveFileDialog";
import RenameFileDialog from "./RenameFileDialog";

type FileContextMenuProps = {
  href: string;
  relativePath: string;
  itemName: string;
  initialPinned: boolean;
  children: ReactNode;
  selectedPaths: string[];
  isDirectory: boolean;
};

type MenuPosition = {
  x: number;
  y: number;
};

export default function FileContextMenu({
  href,
  relativePath,
  itemName,
  initialPinned,
  children,
  selectedPaths,
  isDirectory,
}: FileContextMenuProps) {
  const router = useRouter();
  const menuId = useId();

  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(initialPinned);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({
    x: 0,
    y: 0,
  });
  const [isPending, startTransition] = useTransition();
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);

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
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("blur", closeMenu);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, []);

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

  function handleContextMenu(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    window.dispatchEvent(
      new CustomEvent("connorhub:context-menu-opened", {
        detail: menuId,
      }),
    );

    const menuWidth = 224;
    const menuHeight = 112;
    const viewportPadding = 12;

    setPosition({
      x: Math.max(
        viewportPadding,
        Math.min(
          event.clientX,
          window.innerWidth - menuWidth - viewportPadding,
        ),
      ),
      y: Math.max(
        viewportPadding,
        Math.min(
          event.clientY,
          window.innerHeight - menuHeight - viewportPadding,
        ),
      ),
    });

    setIsOpen(true);
  }

  function handleTogglePinned() {
    startTransition(async () => {
      try {
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
          throw new Error("Unable to update pinned state.");
        }

        const result = (await response.json()) as {
          pinned: boolean;
        };

        setIsPinned(result.pinned);
        setIsOpen(false);
        router.refresh();
      } catch (error) {
        console.error("Unable to update pinned state:", error);
      }
    });
  }

  function handleDuplicate() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/files/duplicate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            relativePath,
          }),
        });

        const result = (await response.json()) as {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(result.error ?? "The item could not be duplicated.");
        }

        setIsOpen(false);
        router.refresh();
      } catch (error) {
        console.error("Unable to duplicate item:", error);
      }
    });
  }

  function handleMoveToTrash() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/files/trash-many", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            relativePaths: selectedPaths,
          }),
        });

        const result = (await response.json()) as {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            result.error ?? "The selected items could not be moved to Trash.",
          );
        }

        setIsOpen(false);
        router.refresh();
      } catch (error) {
        console.error("Unable to move selected items to Trash:", error);
      }
    });
  }

  return (
    <div onContextMenu={handleContextMenu}>
      {children}

      {isOpen && (
        <div
          role="menu"
          aria-label="File actions"
          className="fixed z-50 w-56 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-2xl shadow-black/50"
          style={{
            left: position.x,
            top: position.y,
          }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <ContextMenuLink
            href={href}
            icon={<ExternalLink size={16} />}
            label="Open"
            onClick={() => setIsOpen(false)}
          />

          <div className="my-1 border-t border-zinc-800" />

          <ContextMenuButton
            icon={isPinned ? <PinOff size={16} /> : <Pin size={16} />}
            label={isPinned ? "Unpin from Quick Access" : "Pin to Quick Access"}
            disabled={isPending}
            onClick={handleTogglePinned}
          />
          <ContextMenuButton
            icon={<Pencil size={16} />}
            label="Rename"
            onClick={() => {
              setIsOpen(false);
              setIsRenameDialogOpen(true);
            }}
          />
          <ContextMenuButton
            icon={<FolderInput size={16} />}
            label="Move..."
            onClick={() => {
              setIsOpen(false);
              setIsMoveDialogOpen(true);
            }}
          />
          <ContextMenuButton
            icon={<CopyPlus size={16} />}
            label="Duplicate"
            disabled={isPending}
            onClick={handleDuplicate}
          />
          <div className="my-1 border-t border-zinc-800" />

          <ContextMenuButton
            icon={<Trash2 size={16} />}
            label={
              selectedPaths.length > 1
                ? `Move ${selectedPaths.length} Items to Trash`
                : "Move to Trash"
            }
            disabled={isPending}
            onClick={handleMoveToTrash}
            destructive
          />
        </div>
      )}
      <MoveFileDialog
        itemName={
          selectedPaths.length > 1 ? `${selectedPaths.length} items` : itemName
        }
        sourcePaths={selectedPaths}
        isOpen={isMoveDialogOpen}
        onClose={() => setIsMoveDialogOpen(false)}
      />
      <RenameFileDialog
        itemName={itemName}
        relativePath={relativePath}
        isDirectory={isDirectory}
        isOpen={isRenameDialogOpen}
        onClose={() => setIsRenameDialogOpen(false)}
      />
    </div>
  );
}

type ContextMenuButtonProps = {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
};

function ContextMenuButton({
  icon,
  label,
  disabled = false,
  destructive = false,
  onClick,
}: ContextMenuButtonProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
        destructive
          ? "text-red-300 hover:bg-red-950/50 hover:text-red-200"
          : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
      }`}
    >
      <span className={destructive ? "text-red-400" : "text-zinc-500"}>
        {icon}
      </span>

      <span>{label}</span>
    </button>
  );
}

type ContextMenuLinkProps = {
  href: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
};

function ContextMenuLink({ href, icon, label, onClick }: ContextMenuLinkProps) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
    >
      <span className="text-zinc-500">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
