import { NextRequest, NextResponse } from "next/server";
import type { OverlayApiResponse, OverlayFeatureCollection } from "@/types";
import { fetchArcGisFeatures, toOverlayFeature } from "@/lib/arcgis";

const FLOOD_URL =
  "https://www.portlandmaps.com/od/rest/services/COP_OpenData_PublicSafetyHazards/MapServer/116";

const FLOOD_SOURCE = "City of Portland FEMA Flood Hazard Areas";
const FLOOD_CACHE_SECONDS = 86400;

export const dynamic = "force-dynamic";

interface FloodAttributes {
  OBJECTID?: number;
  FLD_ZONE?: string;
  ZONE_SUBTY?: string;
  SFHA_TF?: string;
}

export async function GET(request: NextRequest) {
  const bbox = parseBbox(request.nextUrl.searchParams.get("bbox"));
  const zoom = parseZoom(request.nextUrl.searchParams.get("zoom"));

  if (!bbox) {
    return NextResponse.json(buildErrorBody("Flood overlay requests require a valid bbox query parameter."), {
      status: 400,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  try {
    const features = await fetchArcGisFeatures<FloodAttributes>({
      serviceUrl: FLOOD_URL,
      where: "SFHA_TF = 'T'",
      outFields: "OBJECTID,FLD_ZONE,ZONE_SUBTY,SFHA_TF",
      revalidateSeconds: FLOOD_CACHE_SECONDS,
      bbox,
      geometryPrecision: 5,
      maxAllowableOffset: floodMaxAllowableOffset(zoom),
    });

    const body: OverlayApiResponse = {
      data: {
        type: "FeatureCollection",
        features: features
          .map((feature) => mapFloodFeature(feature))
          .filter(
            (feature): feature is NonNullable<typeof feature> =>
              feature !== null,
          ),
      } satisfies OverlayFeatureCollection,
      fetchedAt: new Date().toISOString(),
        source: FLOOD_SOURCE,
    };

    return NextResponse.json(body, {
      headers: {
          "Cache-Control": `public, s-maxage=${FLOOD_CACHE_SECONDS}, stale-while-revalidate=3600`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
      const body = buildErrorBody(message);

    return NextResponse.json(body, { status: 200 });
  }
}

  function buildErrorBody(message: string): OverlayApiResponse {
    return {
      data: {
        type: "FeatureCollection",
        features: [],
      },
      fetchedAt: new Date().toISOString(),
      source: FLOOD_SOURCE,
      error: message,
    };
  }

  function parseBbox(value: string | null): [number, number, number, number] | null {
    if (!value) {
      return null;
    }

    const parts = value.split(",").map((part) => Number.parseFloat(part));

    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
      return null;
    }

    const [minLng, minLat, maxLng, maxLat] = parts;

    if (minLng >= maxLng || minLat >= maxLat) {
      return null;
    }

    return [minLng, minLat, maxLng, maxLat];
  }

  function parseZoom(value: string | null): number {
    const parsed = value ? Number.parseFloat(value) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : 12;
  }

  function floodMaxAllowableOffset(zoom: number): number {
    if (zoom >= 15) {
      return 0.00002;
    }

    if (zoom >= 13) {
      return 0.00005;
    }

    if (zoom >= 11) {
      return 0.0001;
    }

    return 0.00025;
  }

function mapFloodFeature(feature: {
  attributes?: FloodAttributes;
  geometry?: unknown;
}) {
  const attributes = feature.attributes ?? {};
  return toOverlayFeature(
    String(attributes.OBJECTID ?? Math.random()),
    feature.geometry,
    {
      overlayId: "flood",
      title: `Flood Hazard Zone ${attributes.FLD_ZONE ?? "Unknown"}`,
      description: attributes.ZONE_SUBTY
        ? `Subtype: ${attributes.ZONE_SUBTY}`
        : "FEMA special flood hazard area.",
      zone: attributes.FLD_ZONE ?? "",
      specialFloodHazard: attributes.SFHA_TF === "T",
    },
  );
}
