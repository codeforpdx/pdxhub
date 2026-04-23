import type {
  CategoryFilter,
  EventCategory,
  MapOverlayConfig,
  EventSeverity,
  LayerStyle,
} from "@/types";

// ──────────────────────────────────────────────────────────────────────────────
// Portland, OR map defaults
// ──────────────────────────────────────────────────────────────────────────────
export const PDX_CENTER: [number, number] = [-122.6765, 45.5231];
export const PDX_DEFAULT_ZOOM = 12;
export const PDX_MIN_ZOOM = 9;
export const PDX_MAX_ZOOM = 18;

// ──────────────────────────────────────────────────────────────────────────────
// Map tile layers
// ──────────────────────────────────────────────────────────────────────────────
export const MAP_LAYERS: LayerStyle[] = [
  {
    id: "carto-voyager",
    label: "Street Map",
    tileUrl:
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    id: "esri-satellite",
    label: "Satellite",
    tileUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
  },
];

export const DEFAULT_MAP_LAYER_ID = "carto-voyager";

// ──────────────────────────────────────────────────────────────────────────────
// Category filters with refresh cadence
// ──────────────────────────────────────────────────────────────────────────────
export const CATEGORY_FILTERS: CategoryFilter[] = [
  {
    id: "police",
    label: "Police / 911",
    color: "#2563eb",
    icon: "Shield",
    enabled: true,
    refreshMs: 15 * 60 * 1000,
    staleNote: "Updates every 15 min",
  },
  {
    id: "fire",
    label: "Fire & Rescue",
    color: "#dc2626",
    icon: "Flame",
    enabled: true,
    refreshMs: 15 * 60 * 1000,
    staleNote: "Updates every 15 min",
  },
  {
    id: "weather",
    label: "Weather / Hazards",
    color: "#d97706",
    icon: "CloudLightning",
    enabled: true,
    refreshMs: 5 * 60 * 1000,
  },
  {
    id: "transit",
    label: "Transit Alerts",
    color: "#16a34a",
    icon: "Bus",
    enabled: true,
    refreshMs: 2 * 60 * 1000,
  },
  {
    id: "bridge",
    label: "Bridge Lifts",
    color: "#7c3aed",
    icon: "ArrowUpDown",
    enabled: true,
    refreshMs: 10 * 60 * 1000,
  },
  {
    id: "road",
    label: "Road Closures",
    color: "#c2410c",
    icon: "Construction",
    enabled: true,
    refreshMs: 10 * 60 * 1000,
  },
  {
    id: "health",
    label: "Health Alerts",
    color: "#0e7490",
    icon: "Stethoscope",
    enabled: true,
    refreshMs: 30 * 60 * 1000,
    staleNote: "Updates every 30 min",
  },
  {
    id: "waterworks",
    label: "Water Works",
    color: "#0284c7",
    icon: "Wrench",
    enabled: true,
    refreshMs: 60 * 60 * 1000,
    staleNote: "Updates every 60 min",
  },
  {
    id: "advisories",
    label: "Water Advisories",
    color: "#0f766e",
    icon: "Droplets",
    enabled: true,
    refreshMs: 30 * 60 * 1000,
    staleNote: "Updates every 30 min",
  },
];

export const MAP_OVERLAYS: MapOverlayConfig[] = [
  {
    id: "cip",
    label: "Capital Projects",
    description:
      "Active city capital improvement work in the public right-of-way.",
    color: "#c2410c",
  },
  {
    id: "flood",
    label: "Flood Zones",
    description:
      "FEMA flood hazard areas for preparedness and situational awareness. Loads for the current map view when zoomed in.",
    color: "#0369a1",
  },
  {
    id: "beecn",
    label: "Earthquake Nodes",
    description:
      "BEECN neighborhood communication sites for major earthquake response.",
    color: "#15803d",
  },
  {
    id: "streetwork",
    label: "Planned Street Work",
    description:
      "PBOT permit jobs currently in design or construction. Best available public substitute for Keep Portland Moving.",
    color: "#92400e",
  },
  {
    id: "highcrash",
    label: "High Crash Intersections",
    description:
      "Portland intersections on PBOT's High Crash Network for safety awareness.",
    color: "#b91c1c",
  },
  {
    id: "highcrashstreets",
    label: "High Crash Streets",
    description:
      "PBOT high-crash corridors for drivers, pedestrians, and bicyclists.",
    color: "#0f766e",
  },
  {
    id: "emergencyroutes",
    label: "Emergency Routes",
    description:
      "Portland emergency transportation routes identified for disaster response and recovery.",
    color: "#7f1d1d",
  },
  {
    id: "potholes",
    label: "Pothole Reports",
    description:
      "Live PBOT pothole reports that are still open or in progress.",
    color: "#7c2d12",
  },
  {
    id: "airquality",
    label: "Air Quality",
    description: "Live EPA AirNow AQI contours covering Portland.",
    color: "#65a30d",
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Severity helpers
// ──────────────────────────────────────────────────────────────────────────────
export function nwsSeverityToSeverity(nws: string): EventSeverity {
  switch (nws?.toLowerCase()) {
    case "extreme":
      return "critical";
    case "severe":
      return "high";
    case "moderate":
      return "medium";
    default:
      return "low";
  }
}

export function severityColor(severity: EventSeverity): string {
  switch (severity) {
    case "critical":
      return "#7f1d1d";
    case "high":
      return "#dc2626";
    case "medium":
      return "#d97706";
    case "low":
      return "#6b7280";
  }
}

export function categoryColor(category: EventCategory): string {
  return CATEGORY_FILTERS.find((f) => f.id === category)?.color ?? "#6b7280";
}

export function categoryLabel(category: EventCategory): string {
  return CATEGORY_FILTERS.find((f) => f.id === category)?.label ?? category;
}

export function categoryLegendLabel(category: EventCategory): string {
  switch (category) {
    case "police":
      return "Police";
    case "fire":
      return "Fire";
    case "weather":
      return "Weather";
    case "transit":
      return "Transit";
    case "bridge":
      return "Bridge";
    case "road":
      return "Road";
    case "health":
      return "Health";
    case "waterworks":
      return "Waterworks";
    case "advisories":
      return "Advisories";
  }
}
