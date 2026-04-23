import { NextResponse } from "next/server";
import type { OverlayApiResponse, OverlayFeatureCollection } from "@/types";
import { fetchArcGisFeatures, toOverlayFeature } from "@/lib/arcgis";

const HIGH_CRASH_URL =
  "https://www.portlandmaps.com/od/rest/services/COP_OpenData_Transportation/MapServer/1428";

export const revalidate = 86400; // 24 h — PBOT High Crash Network is updated annually

interface HighCrashAttributes {
  OBJECTID?: number;
  IntersectionID?: string;
  LocationDescription?: string;
  NumFatal?: number;
  NumInjA?: number;
  NumInjB?: number;
  NumInjC?: number;
  InjuryCosts?: number;
  CurrentRank?: number;
}

export async function GET() {
  try {
    const features = await fetchArcGisFeatures<HighCrashAttributes>({
      serviceUrl: HIGH_CRASH_URL,
      where: "1=1",
      revalidateSeconds: 86400,
    });

    const body: OverlayApiResponse = {
      data: {
        type: "FeatureCollection",
        features: features
          .map((feature) => mapHighCrashFeature(feature))
          .filter(
            (feature): feature is NonNullable<typeof feature> =>
              feature !== null,
          ),
      } satisfies OverlayFeatureCollection,
      fetchedAt: new Date().toISOString(),
      source: "PBOT High Crash Intersections",
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
      source: "PBOT High Crash Intersections",
      error: message,
    };

    return NextResponse.json(body, { status: 200 });
  }
}

function mapHighCrashFeature(feature: {
  attributes?: HighCrashAttributes;
  geometry?: unknown;
}) {
  const attributes = feature.attributes ?? {};
  const numFatal = toWholeNumber(attributes.NumFatal);
  const numInjuryA = toWholeNumber(attributes.NumInjA);
  const numInjuryB = toWholeNumber(attributes.NumInjB);
  const numInjuryC = toWholeNumber(attributes.NumInjC);
  const rank = toWholeNumber(attributes.CurrentRank);

  return toOverlayFeature(
    attributes.IntersectionID ?? String(attributes.OBJECTID ?? Math.random()),
    feature.geometry,
    {
      overlayId: "highcrash",
      title: attributes.LocationDescription ?? "High Crash Intersection",
      description: buildDescription({
        rank,
        numFatal,
        numInjuryA,
        numInjuryB,
        numInjuryC,
      }),
      intersectionId: attributes.IntersectionID ?? "",
      rank,
      fatalities: numFatal,
      seriousInjuries: numInjuryA,
      moderateInjuries: numInjuryB,
      minorInjuries: numInjuryC,
      injuryCosts: toWholeNumber(attributes.InjuryCosts),
    },
  );
}

function buildDescription(values: {
  rank?: number;
  numFatal?: number;
  numInjuryA?: number;
  numInjuryB?: number;
  numInjuryC?: number;
}): string {
  const parts = [
    values.rank
      ? `Ranked #${values.rank} on PBOT's High Crash Network.`
      : undefined,
    `Fatalities: ${values.numFatal ?? 0}`,
    `Serious injuries: ${values.numInjuryA ?? 0}`,
    `Moderate injuries: ${values.numInjuryB ?? 0}`,
    `Minor injuries: ${values.numInjuryC ?? 0}`,
  ].filter(Boolean);

  return parts.join(" ");
}

function toWholeNumber(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.round(value);
}
