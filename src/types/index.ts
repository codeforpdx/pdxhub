// ──────────────────────────────────────────────────────────────────────────────
// Shared types for PDX Hub
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Every data source is normalized into this shape before it hits the UI.
 */
export type EventCategory =
  | "police"
  | "fire"
  | "weather"
  | "transit"
  | "bridge"
  | "road"
  | "health"
  | "waterworks"
  | "advisories";

export type EventSeverity = "low" | "medium" | "high" | "critical";

export interface IncidentEvent {
  id: string;
  category: EventCategory;
  severity: EventSeverity;
  title: string;
  description: string;
  address?: string;
  lat: number;
  lng: number;
  timestamp: string; // ISO 8601
  source: string; // human-readable source name, e.g. "Portland Police Bureau"
  sourceUrl?: string;
  raw?: unknown; // original API payload, kept for debugging
}

// ──────────────────────────────────────────────────────────────────────────────
// Map layer / filter types
// ──────────────────────────────────────────────────────────────────────────────

export interface LayerStyle {
  id: string;
  label: string;
  tileUrl: string;
  attribution: string;
}

export interface CategoryFilter {
  id: EventCategory;
  label: string;
  color: string; // hex, used for map markers and UI badges
  icon: string; // lucide icon name
  enabled: boolean;
  refreshMs: number; // polling interval in milliseconds
  staleNote?: string; // e.g. "Updates every 15 min"
}

export type MapOverlayId =
  | "cip"
  | "flood"
  | "beecn"
  | "streetwork"
  | "highcrash"
  | "emergencyroutes"
  | "highcrashstreets"
  | "potholes"
  | "airquality";

export interface MapOverlayConfig {
  id: MapOverlayId;
  label: string;
  description: string;
  color: string;
}

export type OverlayGeometry =
  | {
      type: "Point";
      coordinates: [number, number];
    }
  | {
      type: "LineString";
      coordinates: [number, number][];
    }
  | {
      type: "MultiLineString";
      coordinates: [number, number][][];
    }
  | {
      type: "Polygon";
      coordinates: [number, number][][];
    }
  | {
      type: "MultiPolygon";
      coordinates: [number, number][][][];
    };

export interface OverlayFeature {
  type: "Feature";
  id?: string | number;
  geometry: OverlayGeometry;
  properties: Record<string, unknown>;
}

export interface OverlayFeatureCollection {
  type: "FeatureCollection";
  features: OverlayFeature[];
}

export interface OverlayApiResponse {
  data: OverlayFeatureCollection;
  fetchedAt: string;
  source: string;
  error?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// API response shapes (raw from public APIs, before normalization)
// ──────────────────────────────────────────────────────────────────────────────

// Portland Open Data (Socrata) – Police CAD / Fire dispatch
export interface SocrataRecord {
  // common fields — actual column names vary per dataset
  [key: string]: string | number | null | undefined;
}

// TriMet Trip Updates / Service Alerts (GTFS-RT / REST)
export interface TriMetAlert {
  id: string;
  header_text?: string;
  description_text?: string;
  effect?: string;
  cause?: string;
  start?: number;
  end?: number;
  routes?: string[];
  url?: string;
  lat?: number;
  lng?: number;
}

// NWS Alerts — api.weather.gov
export interface NWSFeature {
  id: string;
  properties: {
    event: string;
    headline: string;
    description: string;
    severity: string; // "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown"
    urgency: string;
    areaDesc: string;
    onset: string;
    expires: string;
    instruction?: string;
    parameters?: Record<string, string[]>;
  };
  geometry?: GeoJSONPoint | null;
}

export interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

export interface NWSAlertsResponse {
  features: NWSFeature[];
}

// Oregon TripCheck road incidents
export interface TripCheckIncident {
  id: string;
  type: string;
  description: string;
  location: string;
  lat?: number;
  lon?: number;
  startTime?: string;
}

export interface WaterworksGeometry {
  type: string;
  coordinates?: unknown;
  geometries?: WaterworksGeometry[];
}

export interface WaterworksFeature {
  type: "Feature";
  geometry?: WaterworksGeometry | null;
  properties?: Record<string, unknown>;
}

export interface WaterworksFeatureCollection {
  type: "FeatureCollection";
  features?: WaterworksFeature[];
}

export interface WaterAdvisoryAttributes {
  ObjectId?: number;
  PWS_Number?: string;
  PWS_Name?: string;
  Advisory_Label?: string;
  Advisory_Type?: string;
  Advisory_Reason?: string;
  Area_Affected?: string;
  Begin_Date?: number;
  Link_to_Details_Page?: string;
  County?: string;
  Population_Served?: number | string;
  Lat?: number | string;
  Long?: number | string;
  [key: string]: string | number | null | undefined;
}

export interface WaterAdvisoryFeature {
  attributes?: WaterAdvisoryAttributes;
  geometry?: {
    x?: number;
    y?: number;
  } | null;
}

export interface ArcGisFeatureResponse<T> {
  features: T[];
}

// ──────────────────────────────────────────────────────────────────────────────
// API route response type used by all /api/* handlers
// ──────────────────────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T[];
  fetchedAt: string; // ISO timestamp
  source: string;
  error?: string;
}
