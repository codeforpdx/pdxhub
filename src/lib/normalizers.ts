import type {
  EventSeverity,
  IncidentEvent,
  NWSFeature,
  SocrataRecord,
  TriMetAlert,
  TripCheckIncident,
  WaterAdvisoryFeature,
  WaterworksFeature,
  WaterworksGeometry,
} from "@/types";
import { nwsSeverityToSeverity, PDX_CENTER } from "@/lib/constants";

// ──────────────────────────────────────────────────────────────────────────────
// Normalizers: raw API data → IncidentEvent[]
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Portland Police Bureau CAD incidents (Socrata)
 * Dataset: https://www.portlandoregon.gov/police/71978
 */
export function normalizePoliceRecords(
  records: SocrataRecord[],
): IncidentEvent[] {
  return records
    .filter((r) => r.x_coordinate && r.y_coordinate)
    .map((r): IncidentEvent => {
      const lat = parseFloat(String(r.y_coordinate ?? r.lat ?? "0"));
      const lng = parseFloat(String(r.x_coordinate ?? r.lon ?? "0"));
      return {
        id: `police-${r.case_id ?? r.master_incident_number ?? Math.random()}`,
        category: "police",
        severity: categorizePoliceSeverity(
          String(r.offense_type ?? r.final_case_type ?? ""),
        ),
        title: String(r.offense_type ?? r.final_case_type ?? "Police Incident"),
        description:
          [r.neighborhood, r.district_name].filter(Boolean).join(" · ") ||
          "See source for details",
        address: String(r.address ?? r.hundred_block_location ?? ""),
        lat,
        lng,
        timestamp: String(
          r.call_date ?? r.occur_date ?? new Date().toISOString(),
        ),
        source: "Portland Police Bureau",
        sourceUrl: "https://www.portlandoregon.gov/police/",
        raw: r,
      };
    });
}

function categorizePoliceSeverity(offenseType: string): EventSeverity {
  const t = offenseType.toLowerCase();
  if (t.includes("homicide") || t.includes("robbery") || t.includes("assault"))
    return "critical";
  if (t.includes("burglary") || t.includes("theft") || t.includes("vehicle"))
    return "high";
  if (t.includes("disturbance") || t.includes("suspicious")) return "medium";
  return "low";
}

/**
 * Portland Fire & Rescue dispatch (Socrata)
 */
export function normalizeFireRecords(
  records: SocrataRecord[],
): IncidentEvent[] {
  return records
    .filter((r) => r.x_coordinate && r.y_coordinate)
    .map((r): IncidentEvent => {
      const lat = parseFloat(String(r.y_coordinate ?? "0"));
      const lng = parseFloat(String(r.x_coordinate ?? "0"));
      return {
        id: `fire-${r.inc_no ?? r.incident_number ?? Math.random()}`,
        category: "fire",
        severity: categorizeFireSeverity(String(r.inc_type_desc ?? "")),
        title: String(r.inc_type_desc ?? "Fire & Rescue Incident"),
        description: String(r.neighborhood ?? r.district ?? ""),
        address: String(r.address ?? ""),
        lat,
        lng,
        timestamp: String(
          r.alarm_date ?? r.inc_date ?? new Date().toISOString(),
        ),
        source: "Portland Fire & Rescue",
        sourceUrl: "https://www.portland.gov/fire",
        raw: r,
      };
    });
}

function categorizeFireSeverity(type: string): EventSeverity {
  const t = type.toLowerCase();
  if (t.includes("structure") || t.includes("working fire")) return "critical";
  if (t.includes("medical") || t.includes("rescue")) return "high";
  if (t.includes("alarm") || t.includes("investigate")) return "medium";
  return "low";
}

/**
 * NWS Weather Alerts
 * Coordinates for area-based alerts default to downtown Portland
 */
export function normalizeWeatherAlerts(
  features: NWSFeature[],
): IncidentEvent[] {
  return features.map((f): IncidentEvent => {
    const coords = f.geometry?.coordinates ?? PDX_CENTER;
    return {
      id: `weather-${f.id}`,
      category: "weather",
      severity: nwsSeverityToSeverity(f.properties.severity),
      title: f.properties.event,
      description:
        f.properties.headline ?? f.properties.description?.slice(0, 200) ?? "",
      lat: coords[1],
      lng: coords[0],
      timestamp: f.properties.onset ?? new Date().toISOString(),
      source: "National Weather Service",
      sourceUrl: "https://forecast.weather.gov/",
      raw: f,
    };
  });
}

/**
 * TriMet Service Alerts
 * Transit alerts don't always have precise coordinates — default to PDX center
 */
export function normalizeTransitAlerts(alerts: TriMetAlert[]): IncidentEvent[] {
  return alerts.map(
    (a): IncidentEvent => ({
      id: `transit-${a.id}`,
      category: "transit",
      severity: "medium",
      title:
        a.header_text?.trim() ||
        a.description_text?.trim() ||
        "TriMet Service Alert",
      description: a.description_text ?? a.effect ?? "",
      lat: a.lat ?? PDX_CENTER[1],
      lng: a.lng ?? PDX_CENTER[0],
      timestamp: a.start
        ? new Date(
            a.start > 10_000_000_000 ? a.start : a.start * 1000,
          ).toISOString()
        : new Date().toISOString(),
      source: "TriMet",
      sourceUrl: a.url ?? "https://trimet.org/alerts/",
      raw: a,
    }),
  );
}

/**
 * Oregon TripCheck road incidents
 */
export function normalizeRoadIncidents(
  incidents: TripCheckIncident[],
): IncidentEvent[] {
  return incidents
    .filter((i) => i.lat && i.lon)
    .map(
      (i): IncidentEvent => ({
        id: `road-${i.id}`,
        category: "road",
        severity: "medium",
        title: i.type ?? "Road Incident",
        description: i.description ?? i.location ?? "",
        address: i.location,
        lat: i.lat!,
        lng: i.lon!,
        timestamp: i.startTime ?? new Date().toISOString(),
        source: "Oregon TripCheck",
        sourceUrl: "https://tripcheck.com/",
        raw: i,
      }),
    );
}

/**
 * Bridge lift events — no standard open dataset yet; placeholder normalizer
 * for Portland Maps / PBOT API responses.
 */
export function normalizeBridgeLifts(
  records: SocrataRecord[],
): IncidentEvent[] {
  return records.map(
    (r): IncidentEvent => ({
      id: `bridge-${r.bridge_id ?? r.id ?? Math.random()}`,
      category: "bridge",
      severity: "low",
      title: `${r.bridge_name ?? "Bridge"} Lift`,
      description: r.vessel_name
        ? `Vessel: ${r.vessel_name}`
        : "Scheduled lift",
      lat: parseFloat(String(r.lat ?? "45.5231")),
      lng: parseFloat(String(r.lon ?? "-122.6765")),
      timestamp: String(
        r.start_time ?? r.open_time ?? new Date().toISOString(),
      ),
      source: "Portland Bureau of Transportation",
      sourceUrl: "https://www.portland.gov/transportation",
      raw: r,
    }),
  );
}

export function normalizeWaterworksProjects(
  features: WaterworksFeature[],
): IncidentEvent[] {
  return features
    .map((feature, index): IncidentEvent | null => {
      const coordinate = getFeatureCoordinate(feature.geometry);
      if (!coordinate) {
        return null;
      }

      const properties = feature.properties;
      const name = pickText(
        toText(properties?.name),
        toText(properties?.title),
        "Water Works Project",
      );
      const description = pickText(
        toText(properties?.description),
        toText(properties?.type),
        "Portland Water Bureau project",
      );
      const path = toText(properties?.path);
      const titleText = `${name} ${description}`.toLowerCase();

      return {
        id: `waterworks-${toText(properties?.id) ?? path ?? String(index)}`,
        category: "waterworks",
        severity: titleText.match(/shutdown|emergency|outage|interruption/)
          ? "high"
          : "medium",
        title: name,
        description,
        lat: coordinate.lat,
        lng: coordinate.lng,
        timestamp: extractWaterworksTimestamp(properties),
        source: "Portland Water Bureau",
        sourceUrl: path
          ? new URL(path, "https://www.portland.gov").toString()
          : undefined,
        raw: feature,
      };
    })
    .filter((event): event is IncidentEvent => event !== null);
}

export function normalizeWaterAdvisories(
  features: WaterAdvisoryFeature[],
): IncidentEvent[] {
  return features
    .map((feature, index): IncidentEvent | null => {
      const attributes = feature.attributes;
      const lat = toNumber(attributes?.Lat) ?? feature.geometry?.y;
      const lng = toNumber(attributes?.Long) ?? feature.geometry?.x;

      if (lat === undefined || lng === undefined) {
        return null;
      }

      const label = pickText(
        toText(attributes?.Advisory_Label),
        toText(attributes?.Advisory_Type),
        "Water Advisory",
      );
      const systemName = pickText(toText(attributes?.PWS_Name), label);
      const description = [
        toText(attributes?.Advisory_Label),
        toText(attributes?.Advisory_Reason),
        toText(attributes?.Area_Affected),
      ]
        .filter(Boolean)
        .join(" · ");
      const searchText = `${label} ${description}`.toLowerCase();

      return {
        id: `advisory-${toText(attributes?.ObjectId) ?? toText(attributes?.PWS_Number) ?? String(index)}`,
        category: "advisories",
        severity:
          searchText.includes("do not drink") ||
          searchText.includes("do not use")
            ? "critical"
            : searchText.includes("boil")
              ? "high"
              : "medium",
        title: systemName,
        description,
        address:
          [toText(attributes?.Area_Affected), countyLabel(attributes?.County)]
            .filter(Boolean)
            .join(" · ") || undefined,
        lat,
        lng,
        timestamp:
          typeof attributes?.Begin_Date === "number"
            ? new Date(attributes.Begin_Date).toISOString()
            : new Date().toISOString(),
        source: "Oregon Drinking Water Services",
        sourceUrl: toText(attributes?.Link_to_Details_Page),
        raw: feature,
      };
    })
    .filter((event): event is IncidentEvent => event !== null);
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const normalized = stripHtml(value);
    return normalized.length > 0 ? normalized : undefined;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return undefined;
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

function pickText(...values: Array<string | undefined>): string {
  return values.find((value) => value && value.trim().length > 0) ?? "";
}

function extractWaterworksTimestamp(
  properties: WaterworksFeature["properties"],
): string {
  const directDate = toText(properties?.date);
  const description = toText(properties?.description);
  const candidates = [
    directDate,
    description?.match(/Last updated\s+([A-Za-z]+ \d{1,2}, \d{4})/i)?.[1],
    description?.match(/([A-Za-z]+ \d{1,2}, \d{4})/)?.[1],
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const parsed = Date.parse(candidate);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return new Date().toISOString();
}

function countyLabel(county: unknown): string | undefined {
  const text = toText(county);
  if (!text) {
    return undefined;
  }

  return text.toLowerCase().endsWith("county") ? text : `${text} County`;
}

function getFeatureCoordinate(
  geometry: WaterworksGeometry | null | undefined,
): { lat: number; lng: number } | null {
  if (!geometry) {
    return null;
  }

  const coordinates =
    geometry.type === "GeometryCollection"
      ? (geometry.geometries ?? []).flatMap((item) =>
          collectCoordinates(item.coordinates),
        )
      : collectCoordinates(geometry.coordinates);

  const pairs = coordinates.filter(
    ([lng, lat]) =>
      Number.isFinite(lng) &&
      Number.isFinite(lat) &&
      lng >= -180 &&
      lng <= 180 &&
      lat >= -90 &&
      lat <= 90,
  );

  if (pairs.length === 0) {
    return null;
  }

  const { lat, lng } = pairs.reduce(
    (accumulator, [pairLng, pairLat]) => ({
      lat: accumulator.lat + pairLat,
      lng: accumulator.lng + pairLng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: lat / pairs.length,
    lng: lng / pairs.length,
  };
}

function collectCoordinates(value: unknown): Array<[number, number]> {
  if (!Array.isArray(value)) {
    return [];
  }

  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    return [[value[0], value[1]]];
  }

  return value.flatMap((item) => collectCoordinates(item));
}
