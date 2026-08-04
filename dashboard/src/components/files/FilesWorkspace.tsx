"use client";

import { PanelRightOpen } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import FileExplorer from "@/components/files/FileExplorer";
import FileUploader from "@/components/files/FileUploader";
import WorkspacePanel from "@/components/files/WorkspacePanel";
import type { FileBrowserItem } from "@/types/files";

type FilesWorkspaceProps = {
  currentPath: string;
  items: FileBrowserItem[];
  pinnedPaths: string[];
};

const WORKSPACE_OPEN_KEY = "connorhub:workspace-open";
const WORKSPACE_WIDTH_KEY = "connorhub:workspace-width";

const DEFAULT_WORKSPACE_WIDTH = 400;
const MIN_WORKSPACE_WIDTH = 320;
const MAX_WORKSPACE_WIDTH = 620;

export default function FilesWorkspace({
  currentPath,
  items,
  pinnedPaths,
}: FilesWorkspaceProps) {
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(DEFAULT_WORKSPACE_WIDTH);

  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [workspaceWidth, setWorkspaceWidth] = useState(DEFAULT_WORKSPACE_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  const toggleWorkspace = useCallback(() => {
    setIsWorkspaceOpen((current) => !current);
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const storedOpenState = window.localStorage.getItem(WORKSPACE_OPEN_KEY);

      const storedWidth = Number(
        window.localStorage.getItem(WORKSPACE_WIDTH_KEY),
      );

      if (storedOpenState !== null) {
        setIsWorkspaceOpen(storedOpenState === "true");
      }

      if (Number.isFinite(storedWidth)) {
        setWorkspaceWidth(clampWorkspaceWidth(storedWidth));
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(WORKSPACE_OPEN_KEY, String(isWorkspaceOpen));
  }, [isWorkspaceOpen]);

  useEffect(() => {
    window.localStorage.setItem(WORKSPACE_WIDTH_KEY, String(workspaceWidth));
  }, [workspaceWidth]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isWorkspaceShortcut =
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        event.key === ".";

      if (!isWorkspaceShortcut) {
        return;
      }

      const target = event.target;

      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (isTyping) {
        return;
      }

      event.preventDefault();
      toggleWorkspace();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleWorkspace]);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const horizontalDifference = resizeStartXRef.current - event.clientX;

      const nextWidth = resizeStartWidthRef.current + horizontalDifference;

      setWorkspaceWidth(clampWorkspaceWidth(nextWidth));
    }

    function handlePointerUp() {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);

      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  function handleResizeStart(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();

    resizeStartXRef.current = event.clientX;
    resizeStartWidthRef.current = workspaceWidth;

    setIsResizing(true);

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setIsWorkspaceOpen(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100"
        >
          <PanelRightOpen size={16} />
          Workspace
          <span className="hidden text-xs text-zinc-600 sm:inline">CTRL + .</span>
        </button>
      </div>

      <div
        className="grid items-start gap-4"
        style={{
          gridTemplateColumns: isWorkspaceOpen
            ? `minmax(0, 1fr) minmax(0, ${workspaceWidth}px)`
            : "minmax(0, 1fr)",
        }}
      >
        <div className="min-w-0">
          <FileUploader currentPath={currentPath} />

          <FileExplorer items={items} pinnedPaths={pinnedPaths} />
        </div>

        {isWorkspaceOpen && (
          <div className="relative hidden min-w-0 lg:block">
            <button
              type="button"
              aria-label="Resize workspace panel"
              onPointerDown={handleResizeStart}
              className={`absolute inset-y-0 -left-2 z-10 w-4 cursor-col-resize ${
                isResizing ? "bg-zinc-700/30" : ""
              }`}
            >
              <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition hover:bg-zinc-600" />
            </button>

            <WorkspacePanel
              folderPath={currentPath}
              isOpen
              onClose={() => setIsWorkspaceOpen(false)}
            />
          </div>
        )}

        {isWorkspaceOpen && (
          <div className="lg:hidden">
            <WorkspacePanel
              folderPath={currentPath}
              isOpen
              onClose={() => setIsWorkspaceOpen(false)}
            />
          </div>
        )}
      </div>
    </>
  );
}

function clampWorkspaceWidth(width: number): number {
  return Math.min(Math.max(width, MIN_WORKSPACE_WIDTH), MAX_WORKSPACE_WIDTH);
}
