import { NextRequest, NextResponse } from "next/server";
import { rename } from "node:fs/promises";
import path from "node:path";

import { CONNORHUB_ROOT, resolveConnorHubPath } from "@/lib/server-data";
import { pushOperation } from "@/lib/history/operation-history";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      sourcePaths?: unknown;
      destinationFolder?: unknown;
    };

    if (
      !Array.isArray(body.sourcePaths) ||
      typeof body.destinationFolder !== "string"
    ) {
      return NextResponse.json(
        { error: "Source paths and destination folder are required." },
        { status: 400 },
      );
    }

    const sourcePaths = removeNestedSelections(
      body.sourcePaths
        .filter((value): value is string => typeof value === "string")
        .map(sanitizeRelativePath)
        .filter(Boolean),
    );

    const destinationFolder = sanitizeRelativePath(body.destinationFolder);

    if (sourcePaths.length === 0) {
      return NextResponse.json(
        { error: "At least one item must be selected." },
        { status: 400 },
      );
    }

    if (sourcePaths.includes(destinationFolder)) {
      return NextResponse.json(
        {
          error: "The destination folder cannot be one of the selected items.",
        },
        { status: 400 },
      );
    }

    const destinationAbsoluteFolder =
      await resolveConnorHubPath(destinationFolder);

    const movedPaths: string[] = [];

    const moves: Array<{
      fromPath: string;
      toPath: string;
    }> = [];

    for (const sourcePath of sourcePaths) {
      const sourceAbsolutePath = await resolveConnorHubPath(sourcePath);
      const itemName = path.basename(sourceAbsolutePath);

      const destinationAbsolutePath = path.join(
        destinationAbsoluteFolder,
        itemName,
      );

      const destinationRelativePath = path
        .relative(CONNORHUB_ROOT, destinationAbsolutePath)
        .split(path.sep)
        .join("/");

      if (
        destinationAbsoluteFolder === sourceAbsolutePath ||
        destinationAbsoluteFolder.startsWith(`${sourceAbsolutePath}${path.sep}`)
      ) {
        throw new Error(`"${itemName}" cannot be moved inside itself.`);
      }

      await rename(sourceAbsolutePath, destinationAbsolutePath);

      moves.push({
        fromPath: sourcePath,
        toPath: destinationRelativePath,
      });

      movedPaths.push(destinationRelativePath);
    }

    await pushOperation({
      type: "move-many",
      moves,
    });

    return NextResponse.json({
      success: true,
      movedPaths,
    });
  } catch (error) {
    console.error("Unable to move selected items:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The selected items could not be moved.",
      },
      { status: 500 },
    );
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
function removeNestedSelections(paths: string[]): string[] {
  const uniquePaths = [...new Set(paths)];

  return uniquePaths.filter(
    (candidate) =>
      !uniquePaths.some(
        (possibleParent) =>
          possibleParent !== candidate &&
          candidate.startsWith(`${possibleParent}/`),
      ),
  );
}
