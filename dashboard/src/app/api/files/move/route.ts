import { NextRequest, NextResponse } from "next/server";
import { rename } from "node:fs/promises";
import path from "node:path";

import { CONNORHUB_ROOT, resolveConnorHubPath } from "@/lib/server-data";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      sourcePath?: unknown;
      destinationFolder?: unknown;
    };

    if (
      typeof body.sourcePath !== "string" ||
      typeof body.destinationFolder !== "string"
    ) {
      return NextResponse.json(
        { error: "Source and destination paths are required." },
        { status: 400 },
      );
    }

    const sourcePath = sanitizeRelativePath(body.sourcePath);
    const destinationFolder = sanitizeRelativePath(body.destinationFolder);

    if (!sourcePath) {
      return NextResponse.json(
        { error: "The ConnorHub root cannot be moved." },
        { status: 400 },
      );
    }

    const sourceAbsolutePath = await resolveConnorHubPath(sourcePath);
    const destinationAbsoluteFolder =
      await resolveConnorHubPath(destinationFolder);

    const itemName = path.basename(sourceAbsolutePath);
    const destinationAbsolutePath = path.join(
      destinationAbsoluteFolder,
      itemName,
    );

    const resolvedRoot = path.resolve(CONNORHUB_ROOT);
    const resolvedDestination = path.resolve(destinationAbsolutePath);

    if (
      resolvedDestination !== resolvedRoot &&
      !resolvedDestination.startsWith(`${resolvedRoot}${path.sep}`)
    ) {
      return NextResponse.json(
        { error: "Destination is outside ConnorHub storage." },
        { status: 400 },
      );
    }

    if (sourceAbsolutePath === destinationAbsolutePath) {
      return NextResponse.json(
        { error: "The item is already in that folder." },
        { status: 400 },
      );
    }

    if (
      destinationAbsoluteFolder === sourceAbsolutePath ||
      destinationAbsoluteFolder.startsWith(`${sourceAbsolutePath}${path.sep}`)
    ) {
      return NextResponse.json(
        { error: "A folder cannot be moved inside itself." },
        { status: 400 },
      );
    }

    await rename(sourceAbsolutePath, destinationAbsolutePath);

    return NextResponse.json({
      success: true,
      relativePath: path
        .relative(resolvedRoot, destinationAbsolutePath)
        .split(path.sep)
        .join("/"),
    });
  } catch (error) {
    console.error("Unable to move ConnorHub item:", error);

    const message =
      error instanceof Error && "code" in error && error.code === "EEXIST"
        ? "An item with that name already exists in the destination."
        : "The item could not be moved.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function sanitizeRelativePath(value: string): string {
  return value
    .replaceAll("\\", "/")
    .split("/")
    .filter(
      (segment) => segment.length > 0 && segment !== "." && segment !== "..",
    )
    .join("/");
}
