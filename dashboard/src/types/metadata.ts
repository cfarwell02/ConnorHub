export type MetadataSearchEntry = {
  id: string;
  name: string;
  relativePath: string;
  parentPath: string;
  type:
    | "file"
    | "folder"
    | "workspace-note"
    | "workspace-task"
    | "workspace-link";
  extension: string | null;
  sourceFolderPath?: string;
  matchedText?: string;
  url?: string;
};

export type MetadataWorkspaceReference = {
  folderPath: string;
  fileName: string;
  updatedAt: string;
};

export type MetadataRecentItem = {
  relativePath: string;
  type: "file" | "folder" | "workspace";
  openedAt: string;
};

export type ConnorHubMetadata = {
  schemaVersion: 1;
  updatedAt: string;

  search: {
    indexedAt: string | null;
    dirty: boolean;
    entryCount: number;
  };

  workspaces: {
    byFolderPath: Record<string, MetadataWorkspaceReference>;
  };

  recentItems: MetadataRecentItem[];
};
