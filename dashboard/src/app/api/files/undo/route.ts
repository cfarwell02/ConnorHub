import { NextResponse } from "next/server";

import {
  popLastOperation,
  restoreOperation,
} from "@/lib/history/operation-history";
import { restoreTrashRecord } from "@/lib/trash";
import { mkdir, rename } from "node:fs/promises";
import path from "node:path";

import { CONNORHUB_ROOT } from "@/lib/server-data";

export async function POST() {
  const operation = await popLastOperation();

  if (!operation) {
    return NextResponse.json(
      {
        error: "Nothing to undo.",
      },
      {
        status: 404,
      },
    );
  }

  try {
    switch (operation.type) {
      case "trash": {
        const restoredRecord = await restoreTrashRecord(
          operation.trashRecordId,
        );

        return NextResponse.json({
          success: true,
          operation: "trash",
          restoredPath: restoredRecord.originalPath,
        });
      }

      case "trash-many": {
        const restoredRecords = [];

        try {
          for (const trashRecordId of operation.trashRecordIds) {
            const restoredRecord = await restoreTrashRecord(trashRecordId);
            restoredRecords.push(restoredRecord);
          }
        } catch (error) {
          console.error("Unable to restore all trashed items:", error);

          throw error;
        }

        return NextResponse.json({
          success: true,
          operation: "trash-many",
          restoredPaths: restoredRecords.map((record) => record.originalPath),
        });
      }

      case "move-many": {
        const completedMoves: Array<{
          fromPath: string;
          toPath: string;
        }> = [];

        try {
          for (const move of [...operation.moves].reverse()) {
            const currentAbsolutePath = path.join(
              CONNORHUB_ROOT,
              ...move.toPath.split("/"),
            );

            const originalAbsolutePath = path.join(
              CONNORHUB_ROOT,
              ...move.fromPath.split("/"),
            );

            await mkdir(path.dirname(originalAbsolutePath), {
              recursive: true,
            });

            await rename(currentAbsolutePath, originalAbsolutePath);

            completedMoves.push(move);
          }
        } catch (error) {
          for (const move of completedMoves.reverse()) {
            const originalAbsolutePath = path.join(
              CONNORHUB_ROOT,
              ...move.fromPath.split("/"),
            );

            const movedAbsolutePath = path.join(
              CONNORHUB_ROOT,
              ...move.toPath.split("/"),
            );

            await mkdir(path.dirname(movedAbsolutePath), {
              recursive: true,
            });

            await rename(originalAbsolutePath, movedAbsolutePath);
          }

          throw error;
        }

        return NextResponse.json({
          success: true,
          operation: "move-many",
          restoredPaths: operation.moves.map((move) => move.fromPath),
        });
      }

      case "rename": {
        const currentAbsolutePath = path.join(
          CONNORHUB_ROOT,
          ...operation.toPath.split("/"),
        );

        const originalAbsolutePath = path.join(
          CONNORHUB_ROOT,
          ...operation.fromPath.split("/"),
        );

        await rename(currentAbsolutePath, originalAbsolutePath);

        return NextResponse.json({
          success: true,
          operation: "rename",
          restoredPath: operation.fromPath,
        });
      }

      default: {
        await restoreOperation(operation);

        return NextResponse.json(
          { error: "Undo is not implemented for this operation yet." },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    await restoreOperation(operation);

    return NextResponse.json(
      {
        error: "Undo failed.",
      },
      {
        status: 500,
      },
    );
  }
}
