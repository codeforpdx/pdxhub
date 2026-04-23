import { NextResponse } from "next/server";
import type { ApiResponse, IncidentEvent } from "@/types";
import { fetchDispatchEvents } from "@/lib/portland911";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const data: IncidentEvent[] = await fetchDispatchEvents("police");

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
    const body: ApiResponse<IncidentEvent> = {
      data: [],
      fetchedAt: new Date().toISOString(),
      source: "Portland Police Bureau",
      error: message,
    };
    return NextResponse.json(body, { status: 200 }); // 200 so the client retries gracefully
  }
}
