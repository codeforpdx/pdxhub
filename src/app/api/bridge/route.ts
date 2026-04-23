import { NextResponse } from "next/server";
import type { ApiResponse, IncidentEvent } from "@/types";
import { normalizeBridgeLifts } from "@/lib/normalizers";

// Portland Bureau of Transportation – Bridge Lift Schedule
// Socrata dataset for Hawthorne, Steel, Broadway, Burnside, Morrison bridges
// Dataset ID: https://data.portlandoregon.gov/resource/bridge-lifts
const SOCRATA_BRIDGE_URL =
  "https://data.portlandoregon.gov/resource/s93p-i6s8.json";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const params = new URLSearchParams({
      $limit: "50",
      $order: "open_time DESC",
    });

    const appToken = process.env.SOCRATA_APP_TOKEN;
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (appToken) headers["X-App-Token"] = appToken;

    const res = await fetch(`${SOCRATA_BRIDGE_URL}?${params}`, {
      headers,
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error(`Socrata Bridge responded ${res.status}`);
    }

    const raw = await res.json();

    // Attach known bridge coordinates by name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const withCoords = raw.map((r: any) => ({
      ...r,
      ...getBridgeCoords(String(r.bridge_name ?? "")),
    }));

    const data: IncidentEvent[] = normalizeBridgeLifts(withCoords);

    const body: ApiResponse<IncidentEvent> = {
      data,
      fetchedAt: new Date().toISOString(),
      source: "Portland Bureau of Transportation",
    };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        data: [],
        fetchedAt: new Date().toISOString(),
        source: "Portland Bureau of Transportation",
        error: message,
      },
      { status: 200 },
    );
  }
}

const BRIDGE_COORDS: Record<string, { lat: number; lon: number }> = {
  hawthorne: { lat: 45.5114, lon: -122.6679 },
  steel: { lat: 45.5266, lon: -122.6706 },
  broadway: { lat: 45.5285, lon: -122.6723 },
  burnside: { lat: 45.5231, lon: -122.6697 },
  morrison: { lat: 45.5181, lon: -122.6686 },
  tilikum: { lat: 45.5083, lon: -122.6627 },
  sellwood: { lat: 45.4782, lon: -122.6631 },
};

function getBridgeCoords(name: string): { lat: number; lon: number } {
  const key = name.toLowerCase().split(" ")[0];
  return BRIDGE_COORDS[key] ?? { lat: 45.5231, lon: -122.6765 };
}
