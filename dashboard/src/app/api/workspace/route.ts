import { NextRequest, NextResponse } from "next/server";

import {
  getWorkspace,
  saveWorkspace,
  type WorkspaceLink,
  type WorkspaceTask,
} from "@/lib/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const folderPath = request.nextUrl.searchParams.get("path") ?? "";

    const workspace = await getWorkspace(folderPath);

    return NextResponse.json({
      workspace,
    });
  } catch (error) {
    console.error("Unable to load workspace:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The workspace could not be loaded.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      folderPath?: unknown;
      notes?: unknown;
      tasks?: unknown;
      links?: unknown;
    };

    if (typeof body.folderPath !== "string") {
      return NextResponse.json(
        {
          error: "A folder path is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (typeof body.notes !== "string") {
      return NextResponse.json(
        {
          error: "Workspace notes are required.",
        },
        {
          status: 400,
        },
      );
    }

    if (!Array.isArray(body.tasks)) {
      return NextResponse.json(
        {
          error: "Workspace tasks are required.",
        },
        {
          status: 400,
        },
      );
    }

    if (!Array.isArray(body.links)) {
      return NextResponse.json(
        {
          error: "Workspace links are required.",
        },
        {
          status: 400,
        },
      );
    }

    const workspace = await saveWorkspace({
      folderPath: body.folderPath,
      notes: body.notes,
      tasks: body.tasks as WorkspaceTask[],
      links: body.links as WorkspaceLink[],
    });

    return NextResponse.json({
      success: true,
      workspace,
    });
  } catch (error) {
    console.error("Unable to save workspace:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The workspace could not be saved.",
      },
      {
        status: 500,
      },
    );
  }
}
