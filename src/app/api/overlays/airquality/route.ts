import { NextResponse } from "next/server";
import type { OverlayApiResponse, OverlayFeatureCollection } from "@/types";
import { toOverlayFeature } from "@/lib/arcgis";

const AIR_QUALITY_URL =
  "https://services.arcgis.com/cJ9YHowT8TU7DUyn/ArcGIS/rest/services/AirNowLatestContoursCombined/FeatureServer/0";
const PORTLAND_AIR_QUALITY_BOUNDS =
  "-122.875228,45.414915,-122.431469,45.659331";

export const revalidate = 1800; // 30 min — live EPA AQI contours

interface AirQualityAttributes {
  OBJECTID?: number;
  gridcode?: number;
  Timestamp?: number;
  Unixtime?: number;
}

interface ArcGisQueryResponse<T> {
  features?: Array<{
    attributes?: T;
    geometry?: unknown;
  }>;
  error?: {
    message?: string;
  };
}

export async function GET() {
  try {
    const params = new URLSearchParams({
      where: "1=1",
      geometry: PORTLAND_AIR_QUALITY_BOUNDS,
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "gridcode,Timestamp,Unixtime",
      returnGeometry: "true",
      outSR: "4326",
      f: "json",
    });

    const response = await fetch(`${AIR_QUALITY_URL}/query?${params}`, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`AirNow responded ${response.status}`);
    }

    const json =
      (await response.json()) as ArcGisQueryResponse<AirQualityAttributes>;

    if (json.error?.message) {
      throw new Error(json.error.message);
    }

    const body: OverlayApiResponse = {
      data: {
        type: "FeatureCollection",
        features: (json.features ?? [])
          .map((feature) => mapAirQualityFeature(feature))
          .filter(
            (feature): feature is NonNullable<typeof feature> =>
              feature !== null,
          ),
      } satisfies OverlayFeatureCollection,
      fetchedAt: new Date().toISOString(),
      source: "EPA AirNow Latest AQI Contours",
    };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120",
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
      source: "EPA AirNow Latest AQI Contours",
      error: message,
    };

    return NextResponse.json(body, { status: 200 });
  }
}

function mapAirQualityFeature(feature: {
  attributes?: AirQualityAttributes;
  geometry?: unknown;
}) {
  const attributes = feature.attributes ?? {};
  const gridCode = toWholeNumber(attributes.gridcode);

  return toOverlayFeature(
    String(attributes.OBJECTID ?? Math.random()),
    feature.geometry,
    {
      overlayId: "airquality",
      title: `Air Quality: ${aqiLabel(gridCode)}`,
      description: `Current AQI category from EPA AirNow: ${aqiLabel(gridCode)}.`,
      gridCode,
      category: aqiLabel(gridCode),
      timestamp: formatDate(attributes.Timestamp),
      unixTime: attributes.Unixtime ?? null,
    },
  );
}

function aqiLabel(gridCode?: number): string {
  switch (gridCode) {
    case 1:
      return "Good";
    case 2:
      return "Moderate";
    case 3:
      return "Unhealthy for Sensitive Groups";
    case 4:
      return "Unhealthy";
    case 5:
      return "Very Unhealthy";
    case 6:
      return "Hazardous";
    default:
      return "Unknown";
  }
}

function toWholeNumber(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.round(value);
}

function formatDate(value: number | undefined): string | undefined {
  if (!value || !Number.isFinite(value)) {
    return undefined;
  }

  return new Date(value).toISOString();
}
