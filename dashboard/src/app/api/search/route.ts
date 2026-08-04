import { NextRequest, NextResponse } from "next/server";

import { searchConnorHub } from "@/lib/universal-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (!query) {
      return NextResponse.json({
        results: [],
      });
    }

    if (query.length > 200) {
      return NextResponse.json(
        {
          error: "The search query is too long.",
        },
        {
          status: 400,
        },
      );
    }

    const results = await searchConnorHub(query);

    return NextResponse.json({
      query,
      results,
    });
  } catch (error) {
    console.error("Unable to search ConnorHub:", error);

    return NextResponse.json(
      {
        error: "ConnorHub search could not be completed.",
      },
      {
        status: 500,
      },
    );
  }
}
