import { NextResponse } from "next/server";
import type { ApiResponse, IncidentEvent, NWSAlertsResponse } from "@/types";
import { normalizeWeatherAlerts } from "@/lib/normalizers";

// National Weather Service Alerts for Portland OR metro zone (ORZ006)
// No API key required. Free public API.
const NWS_ALERTS_URL =
  "https://api.weather.gov/alerts/active?zone=ORZ006,ORZ007";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const res = await fetch(NWS_ALERTS_URL, {
      headers: {
        Accept: "application/geo+json",
        "User-Agent": "(pdxhub.app, https://github.com/Jared-Krajewski/pdxHub)",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error(`NWS API responded ${res.status}`);
    }

    const raw: NWSAlertsResponse = await res.json();
    const data: IncidentEvent[] = normalizeWeatherAlerts(raw.features ?? []);

    const body: ApiResponse<IncidentEvent> = {
      data,
      fetchedAt: new Date().toISOString(),
      source: "National Weather Service (api.weather.gov)",
    };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        data: [],
        fetchedAt: new Date().toISOString(),
        source: "National Weather Service",
        error: message,
      },
      { status: 200 },
    );
  }
}
