import Link from "next/link";

const storageLinks = [
  { label: "Projects", icon: "📁", path: "Projects" },
  { label: "School", icon: "🎓", path: "School" },
  { label: "Learning", icon: "📚", path: "Learning" },
  { label: "Docs", icon: "📄", path: "Docs" },
  { label: "Assets", icon: "🖼️", path: "Assets" },
  { label: "Archive", icon: "📦", path: "Archive" },
];

export default function Sidebar() {
  return (
    <aside className="hidden min-h-screen w-64 shrink-0 border-r border-zinc-800 bg-zinc-950 lg:flex lg:flex-col">
      <div className="border-b border-zinc-800 px-5 py-6">
        <Link href="/" className="block">
          <p className="text-lg font-semibold tracking-tight text-zinc-100">
            ConnorHub
          </p>

          <p className="mt-1 text-xs text-zinc-500">Personal file explorer</p>
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <div>
          <SidebarLink href="/" icon="⌂" label="Home" />
          <SidebarLink href="/files" icon="📂" label="All Files" />
        </div>

        <div>
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-zinc-600">
            Storage
          </p>

          <div className="space-y-1">
            {storageLinks.map((item) => (
              <SidebarLink
                key={item.path}
                href={`/files?path=${encodeURIComponent(item.path)}`}
                icon={item.icon}
                label={item.label}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-zinc-600">
            Library
          </p>

          <SidebarLink href="/" icon="🕘" label="Recent" />
        </div>
      </nav>

      <div className="border-t border-zinc-800 px-5 py-4">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Raspberry Pi online
        </div>
      </div>
    </aside>
  );
}

type SidebarLinkProps = {
  href: string;
  icon: string;
  label: string;
};

function SidebarLink({ href, icon, label }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
    >
      <span className="w-5 text-center">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
