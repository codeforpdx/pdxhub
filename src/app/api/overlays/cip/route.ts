// Capital Improvement Project (CIP) construction sites from City of Portland Open Data. These are major construction projects that impact transportation and infrastructure in the city. Data source: https://www.portlandmaps.com/od/rest/services/COP_OpenData_PublicWorks/MapServer/24
import { NextResponse } from "next/server";
import type { OverlayApiResponse, OverlayFeatureCollection } from "@/types";
import { fetchArcGisFeatures, toOverlayFeature } from "@/lib/arcgis";

const CIP_POINTS_URL =
  "https://www.portlandmaps.com/od/rest/services/COP_OpenData_CityProjects/MapServer/43";
const CIP_LINES_URL =
  "https://www.portlandmaps.com/od/rest/services/COP_OpenData_CityProjects/MapServer/44";
const CIP_POLYS_URL =
  "https://www.portlandmaps.com/od/rest/services/COP_OpenData_CityProjects/MapServer/45";

export const revalidate = 86400; // 24 h — capital projects update occasionally

interface CipAttributes {
  OBJECTID?: number;
  Project_Number_SAP?: string;
  Project_Name?: string;
  Project_Description?: string;
  Status?: string;
  Phase?: string;
  Bureau_Name?: string;
  URL?: string;
  Est_Construction_Start_Date?: number;
  Est_Construction_Comp_Date?: number;
  Estimated_Design_Start_Date?: number;
  Estimated_Design_Comp_Date?: number;
}

export async function GET() {
  try {
    const [points, lines, polygons] = await Promise.all([
      fetchArcGisFeatures<CipAttributes>({
        serviceUrl: CIP_POINTS_URL,
        where: "Status = 'Active'",
        revalidateSeconds: 3600,
      }),
      fetchArcGisFeatures<CipAttributes>({
        serviceUrl: CIP_LINES_URL,
        where: "Status = 'Active'",
        revalidateSeconds: 3600,
      }),
      fetchArcGisFeatures<CipAttributes>({
        serviceUrl: CIP_POLYS_URL,
        where: "Status = 'Active'",
        revalidateSeconds: 3600,
      }),
    ]);

    const features = [
      ...points.map((feature) => mapCipFeature(feature, "point")),
      ...lines.map((feature) => mapCipFeature(feature, "line")),
      ...polygons.map((feature) => mapCipFeature(feature, "polygon")),
    ].filter(
      (feature): feature is NonNullable<typeof feature> => feature !== null,
    );

    const body: OverlayApiResponse = {
      data: {
        type: "FeatureCollection",
        features,
      } satisfies OverlayFeatureCollection,
      fetchedAt: new Date().toISOString(),
      source: "City of Portland Capital Improvement Projects",
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
      source: "City of Portland Capital Improvement Projects",
      error: message,
    };

    return NextResponse.json(body, { status: 200 });
  }
}

function mapCipFeature(
  feature: {
    attributes?: CipAttributes;
    geometry?: unknown;
  },
  geometryKind: "point" | "line" | "polygon",
) {
  const attributes = feature.attributes ?? {};
  const projectId =
    attributes.Project_Number_SAP ??
    String(attributes.OBJECTID ?? Math.random());

  return toOverlayFeature(projectId, feature.geometry, {
    overlayId: "cip",
    geometryKind,
    title: attributes.Project_Name ?? "Capital Project",
    description:
      attributes.Project_Description ??
      `${attributes.Phase ?? "Project"} in progress`,
    status: attributes.Status ?? "Active",
    phase: attributes.Phase ?? "",
    bureau: attributes.Bureau_Name ?? "City of Portland",
    startDate:
      formatDate(attributes.Est_Construction_Start_Date) ??
      formatDate(attributes.Estimated_Design_Start_Date),
    endDate:
      formatDate(attributes.Est_Construction_Comp_Date) ??
      formatDate(attributes.Estimated_Design_Comp_Date),
    sourceUrl: normalizeUrl(attributes.URL),
  });
}

function formatDate(value: number | undefined): string | undefined {
  if (!value || !Number.isFinite(value)) {
    return undefined;
  }

  return new Date(value).toISOString();
}

function normalizeUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return undefined;
}
