export type FilePresentation = {
  label: string;
  category:
    | "folder"
    | "image"
    | "video"
    | "audio"
    | "pdf"
    | "code"
    | "document"
    | "archive"
    | "file";
};

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "bmp",
  "heic",
]);

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm", "avi", "mkv"]);

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "flac", "ogg"]);

const CODE_EXTENSIONS = new Set([
  "js",
  "jsx",
  "ts",
  "tsx",
  "json",
  "html",
  "css",
  "scss",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "py",
  "go",
  "rs",
  "php",
  "sh",
  "sql",
  "yaml",
  "yml",
  "toml",
]);

const DOCUMENT_EXTENSIONS = new Set([
  "txt",
  "md",
  "doc",
  "docx",
  "rtf",
  "csv",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
]);

const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "tar", "gz", "bz2"]);

export function getFilePresentation(
  name: string,
  isDirectory: boolean,
): FilePresentation {
  if (isDirectory) {
    return {
      label: "Folder",
      category: "folder",
    };
  }

  const extension = getExtension(name);

  if (!extension) {
    return {
      label: "File",
      category: "file",
    };
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return {
      label: `${extension.toUpperCase()} image`,
      category: "image",
    };
  }

  if (VIDEO_EXTENSIONS.has(extension)) {
    return {
      label: `${extension.toUpperCase()} video`,
      category: "video",
    };
  }

  if (AUDIO_EXTENSIONS.has(extension)) {
    return {
      label: `${extension.toUpperCase()} audio`,
      category: "audio",
    };
  }

  if (extension === "pdf") {
    return {
      label: "PDF document",
      category: "pdf",
    };
  }

  if (CODE_EXTENSIONS.has(extension)) {
    return {
      label: `${extension.toUpperCase()} source file`,
      category: "code",
    };
  }

  if (DOCUMENT_EXTENSIONS.has(extension)) {
    return {
      label: `${extension.toUpperCase()} document`,
      category: "document",
    };
  }

  if (ARCHIVE_EXTENSIONS.has(extension)) {
    return {
      label: `${extension.toUpperCase()} archive`,
      category: "archive",
    };
  }

  return {
    label: `${extension.toUpperCase()} file`,
    category: "file",
  };
}

function getExtension(name: string): string {
  const lastDotIndex = name.lastIndexOf(".");

  if (lastDotIndex <= 0 || lastDotIndex === name.length - 1) {
    return "";
  }

  return name.slice(lastDotIndex + 1).toLowerCase();
}
