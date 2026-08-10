"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";

const storageLinks = [
  { label: "Projects", icon: "📁", path: "Projects" },
  { label: "School", icon: "🎓", path: "School" },
  { label: "Assets", icon: "🖼️", path: "Assets" },
];

type SidebarProps = {
  pinnedPaths: string[];
};

export default function Sidebar({ pinnedPaths }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentStoragePath = searchParams.get("path");

  return (
    <aside className="hidden h-screen w-64 shrink-0 border-r border-zinc-800 bg-zinc-950 lg:sticky lg:top-0 lg:flex lg:flex-col">
      <div className="border-b border-zinc-800 px-5 py-5">
        <Link href="/" className="block">
          <p className="text-base font-semibold tracking-tight text-zinc-100">
            ConnorHub
          </p>

          <p className="mt-1 text-xs text-zinc-500">Personal infrastructure</p>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          <SidebarLink
            href="/"
            icon="⌂"
            label="Home"
            active={pathname === "/"}
          />

          <SidebarLink
            href="/files"
            icon="▣"
            label="All Files"
            active={pathname === "/files" && !currentStoragePath}
          />
        </div>

        {pinnedPaths.length > 0 && (
          <>
            <div className="my-4 border-t border-zinc-800" />
            <div>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                Quick Access
              </p>

              <div className="space-y-1">
                {pinnedPaths.map((pinnedPath) => (
                  <SidebarLink
                    key={pinnedPath}
                    href={createPinnedUrl(pinnedPath)}
                    icon="📌"
                    label={getPinnedLabel(pinnedPath)}
                    active={
                      pathname === "/files" && currentStoragePath === pinnedPath
                    }
                  />
                ))}
              </div>
            </div>
          </>
        )}

        <div className="my-4 border-t border-zinc-800" />

        <div>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
            Storage
          </p>

          <div className="space-y-1">
            {storageLinks.map((item) => (
              <SidebarLink
                key={item.path}
                href={`/files?path=${encodeURIComponent(item.path)}`}
                icon={item.icon}
                label={item.label}
                active={
                  pathname === "/files" && currentStoragePath === item.path
                }
              />
            ))}
          </div>
        </div>

        <div className="my-4 border-t border-zinc-800" />

        <div>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
            Library
          </p>

          <SidebarLink
            href="/recent"
            icon="◷"
            label="Recent"
            active={pathname === "/recent"}
          />
        </div>

        <SidebarLink
          href="/trash"
          icon={<Trash2 size={16} />}
          label="Trash"
          active={pathname === "/trash"}
        />
      </nav>

      <div className="border-t border-zinc-800 px-5 py-4">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Raspberry Pi online
        </div>
      </div>
    </aside>
  );
}

type SidebarLinkProps = {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
};

function SidebarLink({ href, icon, label, active = false }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
        active
          ? "bg-zinc-800 text-zinc-100"
          : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
      }`}
    >
      <span className="flex w-5 items-center justify-center">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

function getPinnedLabel(relativePath: string): string {
  const segments = relativePath.split("/").filter(Boolean);

  return segments.at(-1) ?? relativePath;
}

function createPinnedUrl(relativePath: string): string {
  return `/files?path=${encodeURIComponent(relativePath)}`;
}
