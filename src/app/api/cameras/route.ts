import { NextResponse } from "next/server";
import type { ApiResponse, IncidentEvent, TripCheckCamera } from "@/types";
import { normalizeCameras } from "@/lib/normalizers";

// TripCheck requires a keyed API integration. Set as TRIPCHECK_PRIMARY_KEY in .env.local.
// The API uses an APIM subscription key header.
const CCTV_INVENTORY_URL = "https://api.odot.state.or.us/tripcheck/Cctv/Inventory";
const PORTLAND_BOUNDS = "-122.875228,45.414915,-122.631469,45.559331";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const primaryKey = process.env.TRIPCHECK_PRIMARY_KEY?.trim() ?? "";

    if (!primaryKey) {
      throw new Error("TripCheck primary key is missing. Set TRIPCHECK_PRIMARY_KEY in .env.local.");
    }

    const params = new URLSearchParams({
      Bounds: PORTLAND_BOUNDS,
    });

    const res = await fetch(`${CCTV_INVENTORY_URL}?${params}`, {
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

    const rawCameras = raw?.["CCTVInventoryRequest"] ?? [];

    const cameras: TripCheckCamera[] = rawCameras.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (camera: any): TripCheckCamera => {
        const routeId = camera["route-id"];
        const milepoint = camera["milepoint"];
        const location = routeId
          ? `${routeId}${milepoint != null ? ` • MP ${milepoint}` : ""}`
          : (camera["cctv-other"] ?? "");
        // Image URLs come back as http://; upgrade so they load on an https site.
        const cctvUrl: string | undefined = camera["cctv-url"];

        return {
          id: String(camera["device-id"] ?? camera.id ?? Math.random()),
          name: camera["device-name"] ?? "Traffic Camera",
          description: location,
          lat: camera["latitude"],
          lon: camera["longitude"],
          imageUrl: cctvUrl?.replace(/^http:\/\//i, "https://"),
        };
      },
    );

    const data: IncidentEvent[] = normalizeCameras(cameras);

    const body: ApiResponse<IncidentEvent> = {
      data,
      fetchedAt: new Date().toISOString(),
      source: "Oregon TripCheck CCTV",
    };

    return NextResponse.json(body, {
      status: 200,
      headers: {
        // Camera locations are effectively static, so cache the inventory for a
        // day. Live image freshness is handled client-side on the <img>, not here.
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const body: ApiResponse<IncidentEvent> = {
      data: [],
      fetchedAt: new Date().toISOString(),
      source: "Oregon TripCheck CCTV",
      error: message,
    };

    return NextResponse.json(body, {
      status: 200,
      headers: {
        // Don't cache a transient failure for a full day.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
      },
    });
  }
}
