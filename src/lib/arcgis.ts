import type { OverlayFeature, OverlayGeometry } from "@/types";

interface ArcGisQueryResponse<T> {
  features?: T[];
  exceededTransferLimit?: boolean;
  error?: {
    message?: string;
  };
}

export interface ArcGisFeature<TAttributes = Record<string, unknown>> {
  attributes?: TAttributes;
  geometry?: unknown;
}

interface FetchArcGisFeaturesOptions {
  serviceUrl: string;
  where?: string;
  outFields?: string;
  returnGeometry?: boolean;
  pageSize?: number;
  revalidateSeconds?: number;
  bbox?: [number, number, number, number];
  geometryPrecision?: number;
  maxAllowableOffset?: number;
}

export async function fetchArcGisFeatures<
  TAttributes = Record<string, unknown>,
>({
  serviceUrl,
  where = "1=1",
  outFields = "*",
  returnGeometry = true,
  pageSize = 500,
  revalidateSeconds = 0,
  bbox,
  geometryPrecision,
  maxAllowableOffset,
}: FetchArcGisFeaturesOptions): Promise<Array<ArcGisFeature<TAttributes>>> {
  const allFeatures: Array<ArcGisFeature<TAttributes>> = [];
  let offset = 0;

  for (;;) {
    const params = new URLSearchParams({
      where,
      outFields,
      returnGeometry: String(returnGeometry),
      f: "json",
      outSR: "4326",
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
    });

    if (bbox) {
      params.set("geometry", bbox.join(","));
      params.set("geometryType", "esriGeometryEnvelope");
      params.set("inSR", "4326");
      params.set("spatialRel", "esriSpatialRelIntersects");
    }

    if (geometryPrecision !== undefined) {
      params.set("geometryPrecision", String(geometryPrecision));
    }

    if (maxAllowableOffset !== undefined) {
      params.set("maxAllowableOffset", String(maxAllowableOffset));
    }

    const res = await fetch(`${serviceUrl}/query?${params}`, {
      next: { revalidate: revalidateSeconds },
    });

    if (!res.ok) {
      throw new Error(`ArcGIS service responded ${res.status}`);
    }

    const json = (await res.json()) as ArcGisQueryResponse<
      ArcGisFeature<TAttributes>
    >;

    if (json.error?.message) {
      throw new Error(json.error.message);
    }

    const features = json.features ?? [];
    allFeatures.push(...features);

    if (!json.exceededTransferLimit && features.length < pageSize) {
      break;
    }

    if (features.length === 0) {
      break;
    }

    offset += features.length;
  }

  return allFeatures;
}

export function toOverlayFeature(
  id: string | number,
  geometry: unknown,
  properties: Record<string, unknown>,
): OverlayFeature | null {
  const geoJsonGeometry = arcGisGeometryToGeoJson(geometry);
  if (!geoJsonGeometry) {
    return null;
  }

  return {
    type: "Feature",
    id,
    geometry: geoJsonGeometry,
    properties,
  };
}

export function arcGisGeometryToGeoJson(
  geometry: unknown,
): OverlayGeometry | null {
  if (!geometry || typeof geometry !== "object") {
    return null;
  }

  if ("x" in geometry && "y" in geometry) {
    const x = toNumber((geometry as { x?: unknown }).x);
    const y = toNumber((geometry as { y?: unknown }).y);
    if (x === undefined || y === undefined) {
      return null;
    }
    return {
      type: "Point",
      coordinates: [x, y],
    };
  }

  if ("paths" in geometry) {
    const paths = normalizePathCollection(
      (geometry as { paths?: unknown }).paths,
    );
    if (paths.length === 0) {
      return null;
    }
    if (paths.length === 1) {
      return {
        type: "LineString",
        coordinates: paths[0],
      };
    }
    return {
      type: "MultiLineString",
      coordinates: paths,
    };
  }

  if ("rings" in geometry) {
    const rings = normalizePathCollection(
      (geometry as { rings?: unknown }).rings,
    );
    if (rings.length === 0) {
      return null;
    }
    return {
      type: "Polygon",
      coordinates: rings,
    };
  }

  return null;
}

function normalizePathCollection(value: unknown): [number, number][][] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((path) => normalizeCoordinatePath(path))
    .filter((path): path is [number, number][] => path.length > 1);
}

function normalizeCoordinatePath(value: unknown): [number, number][] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((pair) => {
      if (!Array.isArray(pair) || pair.length < 2) {
        return null;
      }

      const lng = toNumber(pair[0]);
      const lat = toNumber(pair[1]);

      if (lng === undefined || lat === undefined) {
        return null;
      }

      return [lng, lat] as [number, number];
    })
    .filter((pair): pair is [number, number] => pair !== null);
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
