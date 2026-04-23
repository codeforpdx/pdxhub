import { NextResponse } from "next/server";
import type { OverlayApiResponse, OverlayFeatureCollection } from "@/types";
import { fetchArcGisFeatures, toOverlayFeature } from "@/lib/arcgis";

const HIGH_CRASH_STREETS_URL =
  "https://www.portlandmaps.com/od/rest/services/COP_OpenData_Transportation/MapServer/1429";

export const revalidate = 86400; // 24 h — PBOT High Crash Streets updated annually

interface HighCrashStreetAttributes {
  OBJECTID?: number;
  CorridorID?: string;
  CorridorName?: string;
  CorridorDescription?: string;
  MotorVehicle?: string;
  Bicycle?: string;
  Pedestrian?: string;
}

export async function GET() {
  try {
    const features = await fetchArcGisFeatures<HighCrashStreetAttributes>({
      serviceUrl: HIGH_CRASH_STREETS_URL,
      where: "1=1",
      revalidateSeconds: 86400,
    });

    const body: OverlayApiResponse = {
      data: {
        type: "FeatureCollection",
        features: features
          .map((feature) => mapHighCrashStreetFeature(feature))
          .filter(
            (feature): feature is NonNullable<typeof feature> =>
              feature !== null,
          ),
      } satisfies OverlayFeatureCollection,
      fetchedAt: new Date().toISOString(),
      source: "PBOT High Crash Streets",
    };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const body: OverlayApiResponse = {
      data: {
        type: "FeatureCollection",
        features: [],
      },
      fetchedAt: new Date().toISOString(),
      source: "PBOT High Crash Streets",
      error: message,
    };

    return NextResponse.json(body, { status: 200 });
  }
}

function mapHighCrashStreetFeature(feature: {
  attributes?: HighCrashStreetAttributes;
  geometry?: unknown;
}) {
  const attributes = feature.attributes ?? {};

  return toOverlayFeature(
    attributes.CorridorID ?? String(attributes.OBJECTID ?? Math.random()),
    feature.geometry,
    {
      overlayId: "highcrashstreets",
      title: attributes.CorridorName ?? "High Crash Street",
      description:
        attributes.CorridorDescription ??
        "High-crash corridor identified by PBOT.",
      corridorId: attributes.CorridorID ?? "",
      motorVehicle: attributes.MotorVehicle === "Y",
      bicycle: attributes.Bicycle === "Y",
      pedestrian: attributes.Pedestrian === "Y",
    },
  );
}
