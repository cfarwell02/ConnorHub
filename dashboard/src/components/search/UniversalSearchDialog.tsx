"use client";

import { File, Folder, Loader2, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type SearchResult = {
  id: string;
  name: string;
  relativePath: string;
  parentPath: string;
  type: "file" | "folder";
  extension: string | null;
};

type SearchResponse = {
  results?: SearchResult[];
  error?: string;
};

export default function UniversalSearchDialog() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setActiveIndex(0);
    setErrorMessage(null);
  }, []);

  function openResult(result: SearchResult) {
    closeDialog();

    if (result.type === "folder") {
      router.push(`/files?path=${encodeURIComponent(result.relativePath)}`);
      return;
    }

    router.push(`/preview?path=${encodeURIComponent(result.relativePath)}`);
  }

  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent) {
      const isSearchShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";

      if (isSearchShortcut) {
        event.preventDefault();
        setIsOpen((current) => !current);
        return;
      }

      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        closeDialog();
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown);

    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [closeDialog, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return;
    }

    const controller = new AbortController();

    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);
      setErrorMessage(null);

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(normalizedQuery)}`,
          {
            signal: controller.signal,
          },
        );

        const result = (await response.json()) as SearchResponse;

        if (!response.ok) {
          throw new Error(result.error ?? "Search could not be completed.");
        }

        setResults(result.results ?? []);
        setActiveIndex(0);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setResults([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Search could not be completed.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 75);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isOpen, query]);

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();

      setActiveIndex((current) =>
        current >= results.length - 1 ? 0 : current + 1,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      setActiveIndex((current) =>
        current <= 0 ? results.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      const activeResult = results[activeIndex];

      if (activeResult) {
        openResult(activeResult);
      }
    }
  }

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 px-4 pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search ConnorHub"
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4">
          <Search size={19} className="shrink-0 text-zinc-500" />

          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value;

              setQuery(nextQuery);

              if (!nextQuery.trim()) {
                setResults([]);
                setIsSearching(false);
                setErrorMessage(null);
                setActiveIndex(0);
              }
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search files and folders..."
            className="h-14 min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          />

          {isSearching ? (
            <Loader2 size={18} className="animate-spin text-zinc-500" />
          ) : (
            <button
              type="button"
              onClick={closeDialog}
              aria-label="Close search"
              className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!query.trim() ? (
            <SearchEmptyState message="Start typing to search ConnorHub." />
          ) : errorMessage ? (
            <SearchEmptyState message={errorMessage} />
          ) : !isSearching && results.length === 0 ? (
            <SearchEmptyState message="No matching files or folders." />
          ) : (
            <div role="listbox" aria-label="Search results">
              {results.map((result, index) => {
                const isActive = index === activeIndex;

                return (
                  <button
                    key={result.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => openResult(result)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                      isActive
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-300 hover:bg-zinc-900"
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500">
                      {result.type === "folder" ? (
                        <Folder size={19} />
                      ) : (
                        <File size={19} />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {result.name}
                      </span>

                      <span className="mt-0.5 block truncate text-xs text-zinc-600">
                        {result.parentPath || "ConnorHub"}
                      </span>
                    </span>

                    <span className="shrink-0 text-xs text-zinc-600">
                      {result.type === "folder"
                        ? "Folder"
                        : (result.extension?.toUpperCase() ?? "File")}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-800 px-4 py-3 text-xs text-zinc-600">
          <span>↑↓ Navigate</span>
          <span>Enter Open</span>
          <span>Esc Close</span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function SearchEmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center px-6 text-center">
      <p className="text-sm text-zinc-600">{message}</p>
    </div>
  );
}
