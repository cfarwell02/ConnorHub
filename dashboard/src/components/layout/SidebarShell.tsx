import { getPinnedPaths } from "@/lib/file-metadata";
import Sidebar from "@/components/layout/Sidebar";

export default async function SidebarShell() {
  const pinnedPaths = await getPinnedPaths();

  return <Sidebar pinnedPaths={pinnedPaths} />;
}
