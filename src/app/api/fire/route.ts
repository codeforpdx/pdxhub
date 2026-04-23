import { NextResponse } from "next/server";
import type { ApiResponse, IncidentEvent } from "@/types";
import { fetchDispatchEvents } from "@/lib/portland911";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const data: IncidentEvent[] = await fetchDispatchEvents("fire");

    const body: ApiResponse<IncidentEvent> = {
      data,
      fetchedAt: new Date().toISOString(),
      source: "Portland Maps 911 Dispatch Feed",
    };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        data: [],
        fetchedAt: new Date().toISOString(),
        source: "Portland Fire & Rescue",
        error: message,
      },
      { status: 200 },
    );
  }
}
