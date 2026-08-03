import { NextResponse } from "next/server";

import {
  popLastOperation,
  restoreOperation,
} from "@/lib/history/operation-history";
import { restoreTrashRecord } from "@/lib/trash";

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

      default:
        await restoreOperation(operation);

        return NextResponse.json(
          {
            error: "Undo is not implemented for this operation yet.",
          },
          {
            status: 400,
          },
        );
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
