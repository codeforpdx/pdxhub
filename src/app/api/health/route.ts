import { NextResponse } from "next/server";
import type { ApiResponse, IncidentEvent } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const body: ApiResponse<IncidentEvent> = {
    data: [],
    fetchedAt: new Date().toISOString(),
    source: "Multnomah County Health",
    error:
      "Health feed disabled. The previous implementation scraped HTML, and this app now only uses documented APIs.",
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=300",
    },
  });
}
