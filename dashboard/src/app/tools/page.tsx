import Link from "next/link";
import {
  Braces,
  FileArchive,
  Files,
  HardDrive,
  Image,
  Network,
  QrCode,
  Server,
  Wrench,
} from "lucide-react";

type ToolCardProps = {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
};

export default function ToolsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-5 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 border-b border-zinc-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400">
              <Wrench size={20} />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Tools</h1>

              <p className="mt-1 text-sm text-zinc-500">
                Utilities for files, media, development, and ConnorHub.
              </p>
            </div>
          </div>
        </header>

        <ToolSection title="Files">
          <ToolCard
            href="/tools/storage"
            icon={<HardDrive size={20} />}
            title="Storage Analyzer"
            description="See what is using space and find your largest files."
          />

          <ToolCard
            href="/tools/duplicates"
            icon={<Files size={20} />}
            title="Duplicate Finder"
            description="Find files that may be taking up unnecessary space."
          />

          <ToolCard
            href="/tools/archive"
            icon={<FileArchive size={20} />}
            title="Archive Tools"
            description="Create, inspect, and extract ZIP archives."
          />
        </ToolSection>

        <ToolSection title="Media">
          <ToolCard
            href="/tools/images"
            icon={<Image size={20} />}
            title="Image Tools"
            description="Compress, resize, and convert images."
          />
        </ToolSection>

        <ToolSection title="Developer">
          <ToolCard
            href="/tools/json"
            icon={<Braces size={20} />}
            title="JSON Tools"
            description="Format, validate, and inspect JSON."
          />

          <ToolCard
            href="/tools/qr"
            icon={<QrCode size={20} />}
            title="QR Generator"
            description="Turn text or links into QR codes."
          />
        </ToolSection>

        <ToolSection title="System">
          <ToolCard
            href="/tools/server"
            icon={<Server size={20} />}
            title="Server Status"
            description="View health and resource usage for the Mac mini."
          />

          <ToolCard
            href="/tools/network"
            icon={<Network size={20} />}
            title="Network Tools"
            description="Run network diagnostics and connectivity checks."
          />
        </ToolSection>
      </div>
    </main>
  );
}

function ToolSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-medium text-zinc-400">{title}</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function ToolCard({ href, icon, title, description }: ToolCardProps) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-700 hover:bg-zinc-800/70"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 transition group-hover:text-zinc-200">
        {icon}
      </div>

      <h3 className="mt-4 text-sm font-semibold text-zinc-200">{title}</h3>

      <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>
    </Link>
  );
}
