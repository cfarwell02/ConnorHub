"use client";

import {
  Check,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  Save,
  StickyNote,
  Trash2,
  X,
  Pencil,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type WorkspaceTask = {
  id: string;
  text: string;
  completed: boolean;
};

type WorkspaceLink = {
  id: string;
  title: string;
  url: string;
};

type FolderWorkspace = {
  folderPath: string;
  notes: string;
  tasks: WorkspaceTask[];
  links: WorkspaceLink[];
  updatedAt: string | null;
};

type WorkspaceResponse = {
  workspace?: FolderWorkspace;
  error?: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

type WorkspacePanelProps = {
  folderPath: string;
  isOpen: boolean;
  onClose: () => void;
};

export default function WorkspacePanel({
  folderPath,
  isOpen,
  onClose,
}: WorkspacePanelProps) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedWorkspaceRef = useRef("");

  const [workspace, setWorkspace] = useState<FolderWorkspace>({
    folderPath,
    notes: "",
    tasks: [],
    links: [],
    updatedAt: null,
  });

  const [newTaskText, setNewTaskText] = useState("");
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingLinkTitle, setEditingLinkTitle] = useState("");
  const [editingLinkUrl, setEditingLinkUrl] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [taskDropTargetId, setTaskDropTargetId] = useState<string | null>(null);

  const saveWorkspace = useCallback(async (nextWorkspace: FolderWorkspace) => {
    const serializedWorkspace = JSON.stringify(nextWorkspace);

    if (serializedWorkspace === lastSavedWorkspaceRef.current) {
      return;
    }

    setSaveStatus("saving");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/workspace", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folderPath: nextWorkspace.folderPath,
          notes: nextWorkspace.notes,
          tasks: nextWorkspace.tasks,
          links: nextWorkspace.links,
        }),
      });

      const result = (await response.json()) as WorkspaceResponse;

      if (!response.ok || !result.workspace) {
        throw new Error(result.error ?? "The workspace could not be saved.");
      }

      setWorkspace(result.workspace);
      lastSavedWorkspaceRef.current = JSON.stringify(result.workspace);
      setSaveStatus("saved");
    } catch (error) {
      console.error("Unable to save workspace:", error);

      setSaveStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The workspace could not be saved.",
      );
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const controller = new AbortController();

    async function loadWorkspace() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(
          `/api/workspace?path=${encodeURIComponent(folderPath)}`,
          {
            signal: controller.signal,
          },
        );

        const result = (await response.json()) as WorkspaceResponse;

        if (!response.ok || !result.workspace) {
          throw new Error(result.error ?? "The workspace could not be loaded.");
        }

        setWorkspace(result.workspace);
        lastSavedWorkspaceRef.current = JSON.stringify(result.workspace);
        setSaveStatus("idle");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error("Unable to load workspace:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The workspace could not be loaded.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      controller.abort();
    };
  }, [folderPath, isOpen]);

  useEffect(() => {
    if (!isOpen || isLoading) {
      return;
    }

    const serializedWorkspace = JSON.stringify(workspace);

    if (serializedWorkspace === lastSavedWorkspaceRef.current) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void saveWorkspace(workspace);
    }, 700);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [isLoading, isOpen, saveWorkspace, workspace]);

  const handleClose = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const serializedWorkspace = JSON.stringify(workspace);

    if (serializedWorkspace !== lastSavedWorkspaceRef.current) {
      void saveWorkspace(workspace);
    }

    onClose();
  }, [onClose, saveWorkspace, workspace]);

  function addTask() {
    const trimmedText = newTaskText.trim();

    if (!trimmedText) {
      return;
    }

    setWorkspace((current) => ({
      ...current,
      tasks: [
        ...current.tasks,
        {
          id: crypto.randomUUID(),
          text: trimmedText,
          completed: false,
        },
      ],
    }));

    setNewTaskText("");
  }

  function toggleTask(taskId: string) {
    setWorkspace((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              completed: !task.completed,
            }
          : task,
      ),
    }));
  }

  function deleteTask(taskId: string) {
    setWorkspace((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId),
    }));
  }

  function moveTask(draggedTaskId: string, targetTaskId: string) {
    if (draggedTaskId === targetTaskId) {
      return;
    }

    setWorkspace((current) => {
      const draggedIndex = current.tasks.findIndex(
        (task) => task.id === draggedTaskId,
      );

      const targetIndex = current.tasks.findIndex(
        (task) => task.id === targetTaskId,
      );

      if (draggedIndex === -1 || targetIndex === -1) {
        return current;
      }

      const nextTasks = [...current.tasks];
      const [draggedTask] = nextTasks.splice(draggedIndex, 1);

      nextTasks.splice(targetIndex, 0, draggedTask);

      return {
        ...current,
        tasks: nextTasks,
      };
    });
  }

  function addLink() {
    const title = newLinkTitle.trim();
    const url = normalizeUrl(newLinkUrl);

    if (!title || !url) {
      return;
    }

    setWorkspace((current) => ({
      ...current,
      links: [
        ...current.links,
        {
          id: crypto.randomUUID(),
          title,
          url,
        },
      ],
    }));

    setNewLinkTitle("");
    setNewLinkUrl("");
  }

  function deleteLink(linkId: string) {
    setWorkspace((current) => ({
      ...current,
      links: current.links.filter((link) => link.id !== linkId),
    }));
  }

  function startEditingLink(link: WorkspaceLink) {
    setEditingLinkId(link.id);
    setEditingLinkTitle(link.title);
    setEditingLinkUrl(link.url);
  }

  function cancelEditingLink() {
    setEditingLinkId(null);
    setEditingLinkTitle("");
    setEditingLinkUrl("");
  }

  function saveEditedLink() {
    if (!editingLinkId) {
      return;
    }

    const title = editingLinkTitle.trim();
    const url = normalizeUrl(editingLinkUrl);

    if (!title || !url) {
      return;
    }

    setWorkspace((current) => ({
      ...current,
      links: current.links.map((link) =>
        link.id === editingLinkId
          ? {
              ...link,
              title,
              url,
            }
          : link,
      ),
    }));

    cancelEditingLink();
  }

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close workspace"
        onClick={handleClose}
        className="fixed inset-0 z-40 bg-black/45 lg:hidden"
      />

      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl lg:static lg:z-auto lg:h-[calc(100vh-2.5rem)] lg:max-w-none lg:rounded-2xl lg:border lg:shadow-none">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StickyNote size={17} className="text-zinc-500" />

              <h2 className="truncate text-sm font-semibold text-zinc-200">
                Workspace
              </h2>
            </div>

            <p className="mt-1 truncate text-xs text-zinc-600">
              {folderPath || "ConnorHub"}
            </p>
          </div>

          <button
            type="button"
            aria-label="Close workspace"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200"
          >
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex min-h-[60vh] items-center justify-center">
              <Loader2 size={20} className="animate-spin text-zinc-600" />
            </div>
          ) : (
            <div className="space-y-5 p-4">
              <section>
                <div className="mb-2 flex items-center gap-2">
                  <StickyNote size={15} className="text-zinc-600" />

                  <h3 className="text-sm font-medium text-zinc-300">Notes</h3>
                </div>

                <textarea
                  value={workspace.notes}
                  onChange={(event) => {
                    setWorkspace((current) => ({
                      ...current,
                      notes: event.target.value,
                    }));

                    setSaveStatus("idle");
                  }}
                  placeholder="Add notes, reminders, links, or context for this folder."
                  className="min-h-48 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm leading-6 text-zinc-300 outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
                />
              </section>

              <section className="border-t border-zinc-800 pt-5">
                <h3 className="text-sm font-medium text-zinc-300">Tasks</h3>

                <div className="mt-3 space-y-2">
                  {workspace.tasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(event) => {
                        setDraggedTaskId(task.id);

                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData(
                          "application/x-connorhub-workspace-task",
                          task.id,
                        );
                      }}
                      onDragOver={(event) => {
                        if (!draggedTaskId || draggedTaskId === task.id) {
                          return;
                        }

                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setTaskDropTargetId(task.id);
                      }}
                      onDragLeave={() => {
                        if (taskDropTargetId === task.id) {
                          setTaskDropTargetId(null);
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();

                        const sourceTaskId =
                          event.dataTransfer.getData(
                            "application/x-connorhub-workspace-task",
                          ) || draggedTaskId;

                        if (sourceTaskId) {
                          moveTask(sourceTaskId, task.id);
                        }

                        setDraggedTaskId(null);
                        setTaskDropTargetId(null);
                      }}
                      onDragEnd={() => {
                        setDraggedTaskId(null);
                        setTaskDropTargetId(null);
                      }}
                      className={`flex cursor-grab items-center gap-3 rounded-lg border bg-zinc-900 px-3 py-2 transition active:cursor-grabbing ${
                        draggedTaskId === task.id
                          ? "border-zinc-700 opacity-50"
                          : taskDropTargetId === task.id
                            ? "border-zinc-500 bg-zinc-800"
                            : "border-zinc-800"
                      }`}
                    >
                      <button
                        type="button"
                        aria-label={
                          task.completed
                            ? `Mark ${task.text} incomplete`
                            : `Mark ${task.text} complete`
                        }
                        onClick={() => toggleTask(task.id)}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                          task.completed
                            ? "border-zinc-500 bg-zinc-200 text-zinc-950"
                            : "border-zinc-700 text-transparent hover:border-zinc-500"
                        }`}
                      >
                        <Check size={13} />
                      </button>

                      <span
                        className={`min-w-0 flex-1 text-sm ${
                          task.completed
                            ? "text-zinc-600 line-through"
                            : "text-zinc-300"
                        }`}
                      >
                        {task.text}
                      </span>

                      <button
                        type="button"
                        aria-label={`Delete ${task.text}`}
                        onClick={() => deleteTask(task.id)}
                        className="text-zinc-700 transition hover:text-red-300"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}

                  {workspace.tasks.length === 0 && (
                    <p className="text-sm text-zinc-700">No tasks yet.</p>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={newTaskText}
                    onChange={(event) => setNewTaskText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTask();
                      }
                    }}
                    placeholder="Add a task"
                    className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
                  />

                  <button
                    type="button"
                    onClick={addTask}
                    disabled={!newTaskText.trim()}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </section>

              <section className="border-t border-zinc-800 pt-5">
                <h3 className="text-sm font-medium text-zinc-300">Links</h3>

                <div className="mt-3 space-y-2">
                  {workspace.links.map((link) => (
                    <div
                      key={link.id}
                      className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2"
                    >
                      {editingLinkId === link.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editingLinkTitle}
                            onChange={(event) =>
                              setEditingLinkTitle(event.target.value)
                            }
                            placeholder="Link title"
                            className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-300 outline-none focus:border-zinc-500"
                          />

                          <input
                            type="url"
                            value={editingLinkUrl}
                            onChange={(event) =>
                              setEditingLinkUrl(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                saveEditedLink();
                              }

                              if (event.key === "Escape") {
                                cancelEditingLink();
                              }
                            }}
                            placeholder="https://..."
                            className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-300 outline-none focus:border-zinc-500"
                          />

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelEditingLink}
                              className="flex h-8 items-center gap-1.5 rounded-md px-3 text-xs text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
                            >
                              <X size={14} />
                              Cancel
                            </button>

                            <button
                              type="button"
                              onClick={saveEditedLink}
                              disabled={
                                !editingLinkTitle.trim() ||
                                !editingLinkUrl.trim()
                              }
                              className="flex h-8 items-center gap-1.5 rounded-md bg-zinc-200 px-3 text-xs font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Check size={14} />
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <Link2 size={15} className="shrink-0 text-zinc-600" />

                          <a
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="min-w-0 flex-1 truncate text-sm text-zinc-300 transition hover:text-zinc-100"
                          >
                            {link.title}
                          </a>

                          <ExternalLink
                            size={14}
                            className="shrink-0 text-zinc-700"
                          />

                          <button
                            type="button"
                            aria-label={`Edit ${link.title}`}
                            onClick={() => startEditingLink(link)}
                            className="text-zinc-700 transition hover:text-zinc-200"
                          >
                            <Pencil size={15} />
                          </button>

                          <button
                            type="button"
                            aria-label={`Delete ${link.title}`}
                            onClick={() => deleteLink(link.id)}
                            className="text-zinc-700 transition hover:text-red-300"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {workspace.links.length === 0 && (
                    <p className="text-sm text-zinc-700">No links yet.</p>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    value={newLinkTitle}
                    onChange={(event) => setNewLinkTitle(event.target.value)}
                    placeholder="Link title"
                    className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
                  />

                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={newLinkUrl}
                      onChange={(event) => setNewLinkUrl(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addLink();
                        }
                      }}
                      placeholder="https://..."
                      className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
                    />

                    <button
                      type="button"
                      onClick={addLink}
                      disabled={!newLinkTitle.trim() || !newLinkUrl.trim()}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>

        <footer className="flex min-h-11 items-center justify-between border-t border-zinc-800 px-4 py-2">
          <p className="truncate text-xs text-red-300">{errorMessage}</p>

          <SaveIndicator status={saveStatus} />
        </footer>
      </aside>
    </>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  switch (status) {
    case "saving":
      return (
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500">
          <Loader2 size={13} className="animate-spin" />
          Saving
        </span>
      );

    case "saved":
      return (
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500">
          <Save size={13} />
          Saved
        </span>
      );

    case "error":
      return <span className="shrink-0 text-xs text-red-300">Save failed</span>;

    default:
      return <span className="shrink-0 text-xs text-zinc-700">Autosaves</span>;
  }
}

function normalizeUrl(value: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  try {
    return new URL(trimmedValue).toString();
  } catch {
    try {
      return new URL(`https://${trimmedValue}`).toString();
    } catch {
      return "";
    }
  }
}
