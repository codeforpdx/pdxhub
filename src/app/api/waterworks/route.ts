import { NextResponse } from "next/server";
import { normalizeWaterworksProjects } from "@/lib/normalizers";
import type {
  ApiResponse,
  IncidentEvent,
  WaterworksFeatureCollection,
} from "@/types";

const WATERWORKS_URL = "https://www.portland.gov/api/waterworks";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const response = await fetch(WATERWORKS_URL, {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`Water Works API responded ${response.status}`);
    }

    const payload: WaterworksFeatureCollection = await response.json();
    const data: IncidentEvent[] = normalizeWaterworksProjects(
      payload.features ?? [],
    );

    const body: ApiResponse<IncidentEvent> = {
      data,
      fetchedAt: new Date().toISOString(),
      source: "Portland Water Bureau",
    };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        data: [],
        fetchedAt: new Date().toISOString(),
        source: "Portland Water Bureau",
        error: message,
      },
      { status: 200 },
    );
  }
}
