import { NextResponse } from "next/server";
import type { OverlayApiResponse, OverlayFeatureCollection } from "@/types";
import { fetchArcGisFeatures, toOverlayFeature } from "@/lib/arcgis";

const STREET_WORK_POINTS_URL =
  "https://www.portlandmaps.com/od/rest/services/COP_OpenData_Transportation/MapServer/56";
const STREET_WORK_LINES_URL =
  "https://www.portlandmaps.com/od/rest/services/COP_OpenData_Transportation/MapServer/65";
const STREET_WORK_POLYS_URL =
  "https://www.portlandmaps.com/od/rest/services/COP_OpenData_Transportation/MapServer/66";
const ACTIVE_STREET_WORK_WHERE = "Status IN ('CONSTRUCTION','DESIGN')";

export const revalidate = 1800; // 30 min — active PBOT permit jobs

interface StreetWorkAttributes {
  OBJECTID?: number;
  ProjectID?: string;
  ProjectName?: string;
  Status?: string;
  ContactName?: string;
  COCDate?: number;
  WarrantyDate?: number;
  LinkPath?: string;
}

export async function GET() {
  try {
    const [points, lines, polygons] = await Promise.all([
      fetchArcGisFeatures<StreetWorkAttributes>({
        serviceUrl: STREET_WORK_POINTS_URL,
        where: ACTIVE_STREET_WORK_WHERE,
        revalidateSeconds: 1800,
      }),
      fetchArcGisFeatures<StreetWorkAttributes>({
        serviceUrl: STREET_WORK_LINES_URL,
        where: ACTIVE_STREET_WORK_WHERE,
        revalidateSeconds: 1800,
      }),
      fetchArcGisFeatures<StreetWorkAttributes>({
        serviceUrl: STREET_WORK_POLYS_URL,
        where: ACTIVE_STREET_WORK_WHERE,
        revalidateSeconds: 1800,
      }),
    ]);

    const features = [
      ...points.map((feature) => mapStreetWorkFeature(feature, "point")),
      ...lines.map((feature) => mapStreetWorkFeature(feature, "line")),
      ...polygons.map((feature) => mapStreetWorkFeature(feature, "polygon")),
    ].filter(
      (feature): feature is NonNullable<typeof feature> => feature !== null,
    );

    const body: OverlayApiResponse = {
      data: {
        type: "FeatureCollection",
        features,
      } satisfies OverlayFeatureCollection,
      fetchedAt: new Date().toISOString(),
      source: "PBOT Streets Permit Jobs",
    };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300",
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
      source: "PBOT Streets Permit Jobs",
      error: message,
    };

    return NextResponse.json(body, { status: 200 });
  }
}

function mapStreetWorkFeature(
  feature: {
    attributes?: StreetWorkAttributes;
    geometry?: unknown;
  },
  geometryKind: "point" | "line" | "polygon",
) {
  const attributes = feature.attributes ?? {};
  const projectId =
    attributes.ProjectID ?? String(attributes.OBJECTID ?? Math.random());

  return toOverlayFeature(projectId, feature.geometry, {
    overlayId: "streetwork",
    geometryKind,
    title: attributes.ProjectName ?? "PBOT Street Work",
    description:
      attributes.Status === "DESIGN"
        ? "Planned street work currently in design."
        : "Street work currently under construction.",
    status: attributes.Status ?? "",
    contact: attributes.ContactName ?? "",
    completionDate: formatDate(attributes.COCDate),
    warrantyDate: formatDate(attributes.WarrantyDate),
    sourceUrl: normalizeLinkPath(attributes.LinkPath),
  });
}

function formatDate(value: number | undefined): string | undefined {
  if (!value || !Number.isFinite(value)) {
    return undefined;
  }

  return new Date(value).toISOString();
}

function normalizeLinkPath(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return undefined;
}
