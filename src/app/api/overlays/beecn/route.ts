// Basic Earthquake Emergency Communication Node (BEECN) locations from City of Portland Open Data. These are neighborhood-based emergency communication sites that can be used when other communication methods are unavailable during a disaster. Data source: https://www.portlandmaps.com/od/rest/services/COP_OpenData_PublicSafetyHazards/MapServer/92

import { NextResponse } from "next/server";
import type { OverlayApiResponse, OverlayFeatureCollection } from "@/types";
import { fetchArcGisFeatures, toOverlayFeature } from "@/lib/arcgis";

const BEECN_URL =
  "https://www.portlandmaps.com/od/rest/services/COP_OpenData_PublicSafetyHazards/MapServer/92";

export const revalidate = 86400; // 24 h — BEECN node locations are stable

interface BeecnAttributes {
  OBJECTID?: number;
  SITE_NAME?: string;
  LOCATION?: string;
  SITE_OWNER?: string;
}

export async function GET() {
  try {
    const features = await fetchArcGisFeatures<BeecnAttributes>({
      serviceUrl: BEECN_URL,
      where: "1=1",
      revalidateSeconds: 86400,
    });

    const body: OverlayApiResponse = {
      data: {
        type: "FeatureCollection",
        features: features
          .map((feature) => mapBeecnFeature(feature))
          .filter(
            (feature): feature is NonNullable<typeof feature> =>
              feature !== null,
          ),
      } satisfies OverlayFeatureCollection,
      fetchedAt: new Date().toISOString(),
      source: "City of Portland BEECN",
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
      source: "City of Portland BEECN",
      error: message,
    };

    return NextResponse.json(body, { status: 200 });
  }
}

function mapBeecnFeature(feature: {
  attributes?: BeecnAttributes;
  geometry?: unknown;
}) {
  const attributes = feature.attributes ?? {};
  return toOverlayFeature(
    String(attributes.OBJECTID ?? Math.random()),
    feature.geometry,
    {
      overlayId: "beecn",
      title: attributes.SITE_NAME ?? "BEECN Site",
      description:
        attributes.LOCATION ?? "Neighborhood emergency communication site.",
      location: attributes.LOCATION ?? "",
      owner: attributes.SITE_OWNER ?? "",
    },
  );
}
