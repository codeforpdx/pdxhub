import { NextResponse } from "next/server";
import type { ApiResponse, IncidentEvent, TripCheckIncident } from "@/types";
import { normalizeRoadIncidents } from "@/lib/normalizers";

// TripCheck requires a keyed API integration. Set as TRIPCHECK_PRIMARY_KEY in .env.local.
// The API uses an APIM subscription key header.
const TRIPCHECK_INCIDENTS_URL =
  "https://api.odot.state.or.us/tripcheck/Incidents";
const PORTLAND_BOUNDS = "-122.875228,45.414915,-122.631469,45.559331";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const primaryKey = process.env.TRIPCHECK_PRIMARY_KEY?.trim() ?? "";

    if (!primaryKey) {
      throw new Error(
        "TripCheck primary key is missing. Set TRIPCHECK_PRIMARY_KEY in .env.local.",
      );
    }

    const params = new URLSearchParams({
      IsActive: "true",
      Bounds: PORTLAND_BOUNDS,
    });

    const res = await fetch(`${TRIPCHECK_INCIDENTS_URL}?${params}`, {
      headers: {
        Accept: "application/json",
        "Ocp-Apim-Subscription-Key": primaryKey,
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error(`TripCheck responded ${res.status}`);
    }

    const raw = await res.json();

    const incidents: TripCheckIncident[] = (raw?.incidents ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (incident: any): TripCheckIncident => ({
        id: String(
          incident["incident-id"] ?? incident["event-id"] ?? Math.random(),
        ),
        type:
          incident["impact-desc"] ??
          incident["event-type-id"] ??
          "Road Incident",
        description: incident.comments ?? incident.headline ?? "",
        location:
          incident?.location?.["start-location"]?.["location-desc"] ??
          incident?.location?.["location-name"] ??
          incident?.location?.["route-id"] ??
          "",
        lat:
          incident?.location?.["start-location"]?.["start-lat"] ??
          incident?.location?.["end-location"]?.["end-lat"],
        lon:
          incident?.location?.["start-location"]?.["start-long"] ??
          incident?.location?.["end-location"]?.["end-long"],
        startTime:
          incident?.schedule?.["project-schedule"]?.["start-date-time"] ??
          incident["create-time"] ??
          incident["update-time"],
      }),
    );

    const data: IncidentEvent[] = normalizeRoadIncidents(incidents);

    const body: ApiResponse<IncidentEvent> = {
      data,
      fetchedAt: new Date().toISOString(),
      source: "Oregon TripCheck",
    };

    return NextResponse.json(body, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const body: ApiResponse<IncidentEvent> = {
      data: [],
      fetchedAt: new Date().toISOString(),
      source: "Oregon TripCheck",
      error: message,
    };

    return NextResponse.json(body, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=60",
      },
    });
  }
}
