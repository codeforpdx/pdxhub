import { NextResponse } from "next/server";
import { normalizeWaterAdvisories } from "@/lib/normalizers";
import type {
  ApiResponse,
  ArcGisFeatureResponse,
  IncidentEvent,
  WaterAdvisoryFeature,
} from "@/types";

const ADVISORIES_URL =
  "https://services.arcgis.com/uUvqNMGPm7axC2dD/arcgis/rest/services/advisories/FeatureServer/0/query";

const PORTLAND_BOUNDS = {
  minLat: 45.414915,
  maxLat: 45.559331,
  minLng: -122.875228,
  maxLng: -122.631469,
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "*",
      returnGeometry: "true",
      f: "json",
    });

    const response = await fetch(`${ADVISORIES_URL}?${params}`, {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`Water advisories API responded ${response.status}`);
    }

    const payload: ArcGisFeatureResponse<WaterAdvisoryFeature> =
      await response.json();
    const inBounds = (payload.features ?? []).filter((feature) => {
      const lat = toNumber(feature.attributes?.Lat) ?? feature.geometry?.y;
      const lng = toNumber(feature.attributes?.Long) ?? feature.geometry?.x;

      return (
        lat !== undefined &&
        lng !== undefined &&
        lat >= PORTLAND_BOUNDS.minLat &&
        lat <= PORTLAND_BOUNDS.maxLat &&
        lng >= PORTLAND_BOUNDS.minLng &&
        lng <= PORTLAND_BOUNDS.maxLng
      );
    });

    const data: IncidentEvent[] = normalizeWaterAdvisories(inBounds);
    const body: ApiResponse<IncidentEvent> = {
      data,
      fetchedAt: new Date().toISOString(),
      source: "Oregon Drinking Water Services",
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
        source: "Oregon Drinking Water Services",
        error: message,
      },
      { status: 200 },
    );
  }
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}
