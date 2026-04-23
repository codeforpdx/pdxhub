import { NextResponse } from "next/server";
import type { OverlayApiResponse, OverlayFeatureCollection } from "@/types";
import { fetchArcGisFeatures, toOverlayFeature } from "@/lib/arcgis";

const POTHOLES_URL =
  "https://www.portlandmaps.com/arcgis/rest/services/Public/PBOT_Maintenance/MapServer/0";
const ACTIVE_POTHOLES_WHERE = "ITEM_STATUS <> 'Closed'";

export const revalidate = 86400; // 24 hours — live PBOT maintenance reports

interface PotholeAttributes {
  OBJECTID?: number;
  ITEM_ID?: number;
  ITEM_STATUS?: string;
  ITEM_DATE_CREATED?: number;
  ITEM_CATEGORY_NAME?: string;
  LOCATION_NEIGHBORHOOD?: string;
}

export async function GET() {
  try {
    const features = await fetchArcGisFeatures<PotholeAttributes>({
      serviceUrl: POTHOLES_URL,
      where: ACTIVE_POTHOLES_WHERE,
      revalidateSeconds: 900,
    });

    const body: OverlayApiResponse = {
      data: {
        type: "FeatureCollection",
        features: features
          .map((feature) => mapPotholeFeature(feature))
          .filter(
            (feature): feature is NonNullable<typeof feature> =>
              feature !== null,
          ),
      } satisfies OverlayFeatureCollection,
      fetchedAt: new Date().toISOString(),
      source: "PBOT Pothole Repair Reports",
    };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=120",
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
      source: "PBOT Pothole Repair Reports",
      error: message,
    };

    return NextResponse.json(body, { status: 200 });
  }
}

function mapPotholeFeature(feature: {
  attributes?: PotholeAttributes;
  geometry?: unknown;
}) {
  const attributes = feature.attributes ?? {};

  return toOverlayFeature(
    String(attributes.ITEM_ID ?? attributes.OBJECTID ?? Math.random()),
    feature.geometry,
    {
      overlayId: "potholes",
      title: attributes.ITEM_CATEGORY_NAME ?? "Pothole Report",
      description: buildDescription(attributes),
      status: attributes.ITEM_STATUS ?? "",
      neighborhood: attributes.LOCATION_NEIGHBORHOOD ?? "",
      createdAt: formatDate(attributes.ITEM_DATE_CREATED),
      itemId: attributes.ITEM_ID ?? null,
    },
  );
}

function buildDescription(attributes: PotholeAttributes): string {
  const parts = [
    attributes.ITEM_STATUS ? `Status: ${attributes.ITEM_STATUS}.` : undefined,
    attributes.LOCATION_NEIGHBORHOOD
      ? `Neighborhood: ${attributes.LOCATION_NEIGHBORHOOD}.`
      : undefined,
  ].filter(Boolean);

  if (parts.length === 0) {
    return "PBOT pothole report.";
  }

  return parts.join(" ");
}

function formatDate(value: number | undefined): string | undefined {
  if (!value || !Number.isFinite(value)) {
    return undefined;
  }

  return new Date(value).toISOString();
}
