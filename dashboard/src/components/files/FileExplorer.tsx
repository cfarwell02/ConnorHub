"use client";

import {
  useEffect,
  useCallback,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  Archive,
  Code2,
  File,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  LayoutGrid,
  List,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";

import type { FileBrowserItem } from "@/types/files";
import FileContextMenu from "./FileContextMenu";
import FolderDropTarget from "./FolderDropTarget";

type SortOption = "name" | "modified" | "size" | "type";
type ViewMode = "list" | "grid";

type FileExplorerProps = {
  items: FileBrowserItem[];
  pinnedPaths: string[];
};

export default function FileExplorer({
  items,
  pinnedPaths,
}: FileExplorerProps) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return [...items]
      .filter((item) => item.name.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }

        switch (sortBy) {
          case "modified":
            return (
              new Date(b.modifiedAt).getTime() -
              new Date(a.modifiedAt).getTime()
            );

          case "size":
            return b.sizeBytes - a.sizeBytes;

          case "type":
            return getFileType(a).localeCompare(getFileType(b));

          case "name":
          default:
            return a.name.localeCompare(b.name, undefined, {
              sensitivity: "base",
            });
        }
      });
  }, [items, query, sortBy]);

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(
    () => new Set(),
  );

  const router = useRouter();
  const [isTrashPending, startTrashTransition] = useTransition();

  function handleSelect(relativePath: string, additive: boolean) {
    setSelectedPaths((current) => {
      const next = new Set(additive ? current : []);

      if (next.has(relativePath)) {
        next.delete(relativePath);
      } else {
        next.add(relativePath);
      }

      return next;
    });
  }

  const moveSelectedToTrash = useCallback(() => {
    if (selectedPaths.size === 0 || isTrashPending) {
      return;
    }

    const pathsToTrash = Array.from(selectedPaths);

    startTrashTransition(async () => {
      try {
        const response = await fetch("/api/files/trash-many", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            relativePaths: pathsToTrash,
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

        setSelectedPaths(new Set());
        router.refresh();
      } catch (error) {
        console.error("Unable to move selected items to Trash:", error);
      }
    });
  }, [isTrashPending, router, selectedPaths]);

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

      const isDeleteKey = event.key === "Delete" || event.key === "Backspace";

      if (!isDeleteKey || selectedPaths.size === 0) {
        return;
      }

      event.preventDefault();
      moveSelectedToTrash();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [moveSelectedToTrash, selectedPaths.size]);

  return (
    <div
      onClick={() => {
        setSelectedPaths(new Set());
      }}
    >
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search
            aria-hidden="true"
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
          />

          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search this folder"
            className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-10 pr-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3">
            <span className="text-sm text-zinc-500">Sort</span>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
              className="bg-transparent text-sm text-zinc-200 outline-none"
            >
              <option value="name">Name</option>
              <option value="modified">Last modified</option>
              <option value="size">Size</option>
              <option value="type">Type</option>
            </select>
          </label>

          <div className="flex h-10 items-center rounded-lg border border-zinc-800 bg-zinc-900 p-1">
            <button
              type="button"
              aria-label="List view"
              aria-pressed={viewMode === "list"}
              onClick={() => setViewMode("list")}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                viewMode === "list"
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-200"
              }`}
            >
              <List size={17} />
            </button>

            <button
              type="button"
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
              onClick={() => setViewMode("grid")}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                viewMode === "grid"
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-200"
              }`}
            >
              <LayoutGrid size={17} />
            </button>
          </div>
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <EmptyState hasQuery={query.trim().length > 0} />
      ) : viewMode === "list" ? (
        <ListView
          items={visibleItems}
          pinnedPaths={pinnedPaths}
          selectedPaths={selectedPaths}
          onSelect={handleSelect}
          onClearSelection={() => setSelectedPaths(new Set())}
        />
      ) : (
        <GridView
          items={visibleItems}
          pinnedPaths={pinnedPaths}
          selectedPaths={selectedPaths}
          onSelect={handleSelect}
          onClearSelection={() => setSelectedPaths(new Set())}
        />
      )}
    </div>
  );
}

function ListView({
  items,
  pinnedPaths,
  selectedPaths,
  onSelect,
  onClearSelection,
}: {
  items: FileBrowserItem[];
  pinnedPaths: string[];
  selectedPaths: Set<string>;
  onSelect: (relativePath: string, additive: boolean) => void;
  onClearSelection: () => void;
}) {
  const router = useRouter();
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      <div className="grid grid-cols-[minmax(0,1fr)_70px_170px] border-b border-zinc-800 px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-600 sm:grid-cols-[minmax(0,1fr)_110px_180px_220px]">
        <span>Name</span>
        <span className="text-right">Size</span>
        <span className="hidden text-right sm:block">Last modified</span>
        <span className="text-right">Actions</span>
      </div>

      <div className="divide-y divide-zinc-800/80">
        {items.map((item) => {
          const href = item.isDirectory
            ? createFilesUrl(item.relativePath)
            : createPreviewUrl(item.relativePath);

          const isSelected = selectedPaths.has(item.relativePath);

          const row = (
            <FileContextMenu
              relativePath={item.relativePath}
              href={href}
              itemName={item.name}
              initialPinned={pinnedPaths.includes(item.relativePath)}
              selectedPaths={
                selectedPaths.has(item.relativePath)
                  ? Array.from(selectedPaths)
                  : [item.relativePath]
              }
              isDirectory={item.isDirectory}
            >
              <div
                draggable
                onClick={(event) => {
                  event.stopPropagation();

                  onSelect(item.relativePath, event.metaKey || event.ctrlKey);
                }}
                onDragStart={(event) => {
                  event.currentTarget.classList.add("opacity-50");
                  handleDragStart(event, item.relativePath, selectedPaths);
                }}
                onDragEnd={handleDragEnd}
                className={`grid grid-cols-[minmax(0,1fr)_70px_170px] cursor-default items-center transition sm:grid-cols-[minmax(0,1fr)_110px_180px_220px] ${
                  isSelected ? "bg-zinc-700/60" : "hover:bg-zinc-800/45"
                }`}
              >
                {" "}
                <div
                  onDoubleClick={() => router.push(href)}
                  className="flex min-w-0 cursor-default items-center gap-3 px-4 py-3.5"
                >
                  <FileIcon item={item} />

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-200">
                      {item.name}
                    </p>

                    <p className="mt-0.5 truncate text-xs text-zinc-600">
                      {getDisplayType(item)}
                    </p>
                  </div>
                </div>
                <span className="px-2 text-right text-sm text-zinc-500">
                  {item.isDirectory ? "—" : formatBytes(item.sizeBytes)}
                </span>
                <span className="hidden px-2 text-right text-sm text-zinc-500 sm:block">
                  {formatModifiedDate(item.modifiedAt)}
                </span>
              </div>
            </FileContextMenu>
          );

          return item.isDirectory ? (
            <FolderDropTarget
              key={item.relativePath}
              destinationPath={item.relativePath}
              onMoveComplete={onClearSelection}
            >
              {row}
            </FolderDropTarget>
          ) : (
            <div key={item.relativePath}>{row}</div>
          );
        })}
      </div>
    </section>
  );
}

function GridView({
  items,
  pinnedPaths,
  selectedPaths,
  onSelect,
  onClearSelection,
}: {
  items: FileBrowserItem[];
  pinnedPaths: string[];
  selectedPaths: Set<string>;
  onSelect: (relativePath: string, additive: boolean) => void;
  onClearSelection: () => void;
}) {
  const router = useRouter();
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => {
        const href = item.isDirectory
          ? createFilesUrl(item.relativePath)
          : createPreviewUrl(item.relativePath);

        const isSelected = selectedPaths.has(item.relativePath);

        const card = (
          <FileContextMenu
            relativePath={item.relativePath}
            href={href}
            itemName={item.name}
            initialPinned={pinnedPaths.includes(item.relativePath)}
            selectedPaths={
              selectedPaths.has(item.relativePath)
                ? Array.from(selectedPaths)
                : [item.relativePath]
            }
            isDirectory={item.isDirectory}
          >
            <div
              draggable
              onClick={(event) => {
                onSelect(item.relativePath, event.metaKey || event.ctrlKey);
              }}
              onDragStart={(event) => {
                event.currentTarget.classList.add("opacity-50");
                handleDragStart(event, item.relativePath, selectedPaths);
              }}
              onDragEnd={handleDragEnd}
              className={`group relative cursor-grab rounded-xl border p-3 transition active:cursor-grabbing ${
                isSelected
                  ? "border-zinc-500 bg-zinc-700/60 ring-1 ring-zinc-500"
                  : "border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/60"
              }`}
            >
              {" "}
              <div
                onDoubleClick={() => router.push(href)}
                className="block cursor-default"
              >
                <div className="flex h-24 items-center justify-center rounded-lg bg-zinc-950/60">
                  <FileIcon item={item} size={38} />
                </div>

                <div className="mt-3 min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-200">
                    {item.name}
                  </p>

                  <p className="mt-1 truncate text-xs text-zinc-600">
                    {item.isDirectory ? "Folder" : formatBytes(item.sizeBytes)}
                  </p>
                </div>
              </div>
            </div>
          </FileContextMenu>
        );

        return item.isDirectory ? (
          <FolderDropTarget
            key={item.relativePath}
            destinationPath={item.relativePath}
            onMoveComplete={onClearSelection}
          >
            {card}
          </FolderDropTarget>
        ) : (
          <div key={item.relativePath}>{card}</div>
        );
      })}
    </section>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/60 px-6 text-center">
      {hasQuery ? (
        <Search size={36} className="text-zinc-700" />
      ) : (
        <Folder size={36} className="text-zinc-700" />
      )}

      <h2 className="mt-4 text-base font-medium text-zinc-300">
        {hasQuery ? "No files found" : "This folder is empty"}
      </h2>

      <p className="mt-1 max-w-sm text-sm text-zinc-600">
        {hasQuery
          ? "Try a different search term."
          : "Upload files or create a folder to get started."}
      </p>
    </section>
  );
}

function FileIcon({
  item,
  size = 20,
}: {
  item: FileBrowserItem;
  size?: number;
}) {
  const iconClassName = "shrink-0 text-zinc-400";

  if (item.isDirectory) {
    return <Folder size={size} strokeWidth={1.7} className={iconClassName} />;
  }

  const extension = getExtension(item.name);

  if (imageExtensions.has(extension)) {
    return (
      <FileImage size={size} strokeWidth={1.7} className={iconClassName} />
    );
  }

  if (videoExtensions.has(extension)) {
    return (
      <FileVideo size={size} strokeWidth={1.7} className={iconClassName} />
    );
  }

  if (audioExtensions.has(extension)) {
    return (
      <FileAudio size={size} strokeWidth={1.7} className={iconClassName} />
    );
  }

  if (archiveExtensions.has(extension)) {
    return <Archive size={size} strokeWidth={1.7} className={iconClassName} />;
  }

  if (codeExtensions.has(extension)) {
    return <Code2 size={size} strokeWidth={1.7} className={iconClassName} />;
  }

  if (documentExtensions.has(extension)) {
    return <FileText size={size} strokeWidth={1.7} className={iconClassName} />;
  }

  return <File size={size} strokeWidth={1.7} className={iconClassName} />;
}

const imageExtensions = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "heic",
]);

const videoExtensions = new Set(["mp4", "mov", "avi", "mkv", "webm"]);

const audioExtensions = new Set(["mp3", "wav", "m4a", "flac", "aac"]);

const archiveExtensions = new Set(["zip", "rar", "7z", "tar", "gz"]);

const codeExtensions = new Set([
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "java",
  "c",
  "cpp",
  "cs",
  "html",
  "css",
  "json",
  "md",
  "sh",
]);

const documentExtensions = new Set([
  "txt",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
]);

function getExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");

  return parts.length > 1 ? (parts.at(-1) ?? "") : "";
}

function getFileType(item: FileBrowserItem): string {
  if (item.isDirectory) {
    return "folder";
  }

  return getExtension(item.name);
}

function getDisplayType(item: FileBrowserItem): string {
  if (item.isDirectory) {
    return "Folder";
  }

  const extension = getExtension(item.name);

  return extension ? `${extension.toUpperCase()} file` : "File";
}

function createFilesUrl(relativePath: string): string {
  return relativePath
    ? `/files?path=${encodeURIComponent(relativePath)}`
    : "/files";
}

function createPreviewUrl(relativePath: string): string {
  return `/preview?path=${encodeURIComponent(relativePath)}`;
}

function formatModifiedDate(value: Date): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function handleDragStart(
  event: React.DragEvent<HTMLElement>,
  draggedPath: string,
  selectedPaths: Set<string>,
) {
  event.dataTransfer.effectAllowed = "move";

  const pathsToMove = selectedPaths.has(draggedPath)
    ? Array.from(selectedPaths)
    : [draggedPath];

  event.dataTransfer.setData(
    "application/x-connorhub-paths",
    JSON.stringify(pathsToMove),
  );

  const dragPreview = document.createElement("div");

  dragPreview.textContent =
    pathsToMove.length === 1
      ? getDraggedItemName(pathsToMove[0])
      : `${pathsToMove.length} items`;

  Object.assign(dragPreview.style, {
    position: "fixed",
    left: "-9999px",
    top: "-9999px",
    padding: "8px 12px",
    borderRadius: "8px",
    background: "#27272a",
    color: "#f4f4f5",
    fontSize: "13px",
    fontWeight: "500",
    border: "1px solid #52525b",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
    pointerEvents: "none",
  });

  document.body.appendChild(dragPreview);
  event.dataTransfer.setDragImage(dragPreview, 16, 16);

  requestAnimationFrame(() => {
    dragPreview.remove();
  });
}

function handleDragEnd(event: React.DragEvent<HTMLElement>) {
  event.currentTarget.classList.remove("opacity-50");
}

function getDraggedItemName(relativePath: string): string {
  return relativePath.split("/").filter(Boolean).at(-1) ?? relativePath;
}
