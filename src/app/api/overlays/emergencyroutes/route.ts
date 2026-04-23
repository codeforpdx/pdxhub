import { NextResponse } from "next/server";
import type { OverlayApiResponse, OverlayFeatureCollection } from "@/types";
import { fetchArcGisFeatures, toOverlayFeature } from "@/lib/arcgis";

const EMERGENCY_ROUTES_URL =
  "https://www.portlandmaps.com/od/rest/services/COP_OpenData_Transportation/MapServer/181";

export const revalidate = 86400; // 24 h — emergency routes are quasi-static infrastructure data

interface EmergencyRouteAttributes {
  OBJECTID?: number;
  PREFIX?: string;
  STREETNAME?: string;
  FTYPE?: string;
  ETR_ID?: number;
  ROUTENAME?: string;
  ROUTE_FROM?: string;
  ROUTE_TO?: string;
  OWNER?: string;
  LENGTH?: number;
}

export async function GET() {
  try {
    const features = await fetchArcGisFeatures<EmergencyRouteAttributes>({
      serviceUrl: EMERGENCY_ROUTES_URL,
      where: "1=1",
      revalidateSeconds: 86400,
    });

    const body: OverlayApiResponse = {
      data: {
        type: "FeatureCollection",
        features: features
          .map((feature) => mapEmergencyRouteFeature(feature))
          .filter(
            (feature): feature is NonNullable<typeof feature> =>
              feature !== null,
          ),
      } satisfies OverlayFeatureCollection,
      fetchedAt: new Date().toISOString(),
      source:
        "Portland Bureau of Emergency Management Emergency Transportation Routes",
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
      source:
        "Portland Bureau of Emergency Management Emergency Transportation Routes",
      error: message,
    };

    return NextResponse.json(body, { status: 200 });
  }
}

function mapEmergencyRouteFeature(feature: {
  attributes?: EmergencyRouteAttributes;
  geometry?: unknown;
}) {
  const attributes = feature.attributes ?? {};
  const streetLabel = [
    attributes.PREFIX,
    attributes.STREETNAME,
    attributes.FTYPE,
  ]
    .filter((value) => typeof value === "string" && value.length > 0)
    .join(" ");
  const routeName = attributes.ROUTENAME ?? streetLabel ?? "Emergency Route";

  return toOverlayFeature(
    String(attributes.OBJECTID ?? Math.random()),
    feature.geometry,
    {
      overlayId: "emergencyroutes",
      title: routeName,
      description: buildDescription(attributes),
      routeId: attributes.ETR_ID ?? null,
      streetName: streetLabel,
      routeFrom: attributes.ROUTE_FROM ?? "",
      routeTo: attributes.ROUTE_TO ?? "",
      owner: attributes.OWNER ?? "",
      length: formatLength(attributes.LENGTH),
    },
  );
}

function buildDescription(attributes: EmergencyRouteAttributes): string {
  const segments = [
    attributes.ROUTE_FROM ? `From ${attributes.ROUTE_FROM}` : undefined,
    attributes.ROUTE_TO ? `to ${attributes.ROUTE_TO}` : undefined,
    attributes.OWNER ? `Maintained by ${attributes.OWNER}.` : undefined,
  ].filter(Boolean);

  if (segments.length === 0) {
    return "Emergency transportation route used for disaster response and recovery.";
  }

  return `${segments.join(" ")} Emergency transportation route used for disaster response and recovery.`;
}

function formatLength(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.round(value);
}
