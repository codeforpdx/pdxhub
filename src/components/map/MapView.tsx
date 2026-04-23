"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type {
  CategoryFilter,
  IncidentEvent,
  LayerStyle,
  MapOverlayId,
  OverlayApiResponse,
  OverlayFeatureCollection,
} from "@/types";
import {
  categoryColor,
  MAP_OVERLAYS,
  PDX_CENTER,
  PDX_DEFAULT_ZOOM,
  PDX_MIN_ZOOM,
  PDX_MAX_ZOOM,
} from "@/lib/constants";
import type { Location } from "./LocationSearch";

interface MapViewProps {
  events: IncidentEvent[];
  activeLayer: LayerStyle;
  filters: CategoryFilter[];
  onEventSelect: (event: IncidentEvent) => void;
  selectedEventId?: string;
  flyToLocation?: Location | null;
  activeOverlayIds: MapOverlayId[];
}

const FLOOD_OVERLAY_MIN_ZOOM = 11;
const FLOOD_OVERLAY_BBOX_PRECISION = 3;

export default function MapView({
  events,
  activeLayer,
  filters,
  onEventSelect,
  selectedEventId,
  flyToLocation,
  activeOverlayIds,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);
  const overlayRequestsRef = useRef<Set<MapOverlayId>>(new Set());
  const overlayCacheRef = useRef<Map<string, OverlayFeatureCollection>>(
    new Map(),
  );
  const floodRequestKeyRef = useRef<string | null>(null);
  const floodViewportKeyRef = useRef<string | null>(null);
  const [overlayData, setOverlayData] = useState<
    Partial<Record<MapOverlayId, OverlayFeatureCollection>>
  >({});

  // Derive enabled category IDs for fast lookup
  const enabledCategories = useMemo(
    () => new Set(filters.filter((f) => f.enabled).map((f) => f.id)),
    [filters],
  );
  const activeOverlaySet = useMemo(
    () => new Set(activeOverlayIds),
    [activeOverlayIds],
  );

  // Always-current refs so the selection fly-to effect only fires on real selection
  // changes and not on every SWR refresh or filter toggle.
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const enabledCategoriesRef = useRef(enabledCategories);
  enabledCategoriesRef.current = enabledCategories;

  // ── Initialize map ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyleFromLayer(activeLayer),
      center: PDX_CENTER,
      zoom: PDX_DEFAULT_ZOOM,
      minZoom: PDX_MIN_ZOOM,
      maxZoom: PDX_MAX_ZOOM,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    map.addControl(new maplibregl.NavigationControl(), "bottom-right");
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      "bottom-right",
    );

    mapRef.current = map;

    return () => {
      searchMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Swap tile layer when user changes it ───────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    map.setStyle(buildStyleFromLayer(activeLayer));
  }, [activeLayer]);

  // ── Render markers ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const visible = events.filter((e) => enabledCategories.has(e.category));
    const visibleIds = new Set(visible.map((e) => e.id));

    // Remove stale markers
    markersRef.current.forEach((marker, id) => {
      if (!visibleIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add new markers
    visible.forEach((event) => {
      if (markersRef.current.has(event.id)) return;

      const el = createMarkerElement(event);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onEventSelect(event);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([event.lng, event.lat])
        .addTo(map);

      markersRef.current.set(event.id, marker);
    });
  }, [events, enabledCategories, onEventSelect]);

  // ── Fly to selected event — ONLY fires when the selection ID itself changes ─
  // Using refs for events/enabledCategories means filter toggles and SWR
  // refreshes will NOT re-trigger this effect and will NOT move the map.
  useEffect(() => {
    if (!selectedEventId) {
      popupRef.current?.remove();
      popupRef.current = null;
      return;
    }

    const event = eventsRef.current.find((e) => e.id === selectedEventId);
    if (!event || !enabledCategoriesRef.current.has(event.category)) {
      popupRef.current?.remove();
      popupRef.current = null;
      return;
    }

    const map = mapRef.current;
    if (!map) return;

    map.flyTo({
      center: [event.lng, event.lat],
      zoom: Math.max(map.getZoom(), 14),
      duration: 600,
    });

    popupRef.current?.remove();
    popupRef.current = new maplibregl.Popup({ offset: 24, closeButton: true })
      .setLngLat([event.lng, event.lat])
      .setHTML(buildPopupHTML(event))
      .addTo(map);
  }, [selectedEventId]);

  // ── Close popup only when the selected event's category is filtered out ─────
  // Separate from the fly-to above so filter toggles never move the map.
  useEffect(() => {
    if (!selectedEventId || !popupRef.current) return;
    const event = events.find((e) => e.id === selectedEventId);
    if (!event || !enabledCategories.has(event.category)) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  }, [enabledCategories, selectedEventId, events]);

  // ── Fly to geocoded location ───────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;

    if (!flyToLocation) {
      // Search was cleared — remove the dropped pin
      if (searchMarkerRef.current) {
        searchMarkerRef.current.remove();
        searchMarkerRef.current = null;
      }
      return;
    }

    if (!map) return;
    popupRef.current?.remove();

    if (!searchMarkerRef.current) {
      searchMarkerRef.current = new maplibregl.Marker({
        element: createSearchMarkerElement(),
      });
    }

    searchMarkerRef.current
      .setLngLat([flyToLocation.lng, flyToLocation.lat])
      .addTo(map);

    map.flyTo({
      center: [flyToLocation.lng, flyToLocation.lat],
      zoom: 15,
      duration: 800,
    });

    searchMarkerRef.current
      .setPopup(
        new maplibregl.Popup({ offset: 18, closeButton: false }).setText(
          flyToLocation.displayName,
        ),
      )
      .togglePopup();
  }, [flyToLocation]);

  // ── Fetch overlay data lazily when enabled ───────────────────────────────
  useEffect(() => {
    activeOverlayIds.forEach((overlayId) => {
      if (overlayId === "flood") {
        return;
      }

      if (overlayData[overlayId] || overlayRequestsRef.current.has(overlayId)) {
        return;
      }

      overlayRequestsRef.current.add(overlayId);

      void fetch(`/api/overlays/${overlayId}`)
        .then(async (response) => {
          const payload = (await response.json()) as OverlayApiResponse;
          if (payload.error) {
            throw new Error(payload.error);
          }

          setOverlayData((prev) => ({
            ...prev,
            [overlayId]: payload.data,
          }));
        })
        .catch((error: unknown) => {
          console.warn(`Overlay ${overlayId} failed`, error);
        })
        .finally(() => {
          overlayRequestsRef.current.delete(overlayId);
        });
    });
  }, [activeOverlayIds, overlayData]);

  // ── Fetch flood overlay per viewport to avoid loading the full city layer ─
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const clearFloodOverlay = () => {
      floodViewportKeyRef.current = null;
      setOverlayData((prev) => {
        if (!prev.flood) {
          return prev;
        }

        const next = { ...prev };
        delete next.flood;
        return next;
      });
    };

    if (!activeOverlaySet.has("flood")) {
      clearFloodOverlay();
      return;
    }

    const syncFloodOverlay = () => {
      const activeMap = mapRef.current;
      if (!activeMap) {
        return;
      }

      const request = buildFloodOverlayRequest(activeMap);

      if (!request) {
        clearFloodOverlay();
        return;
      }

      floodViewportKeyRef.current = request.key;

      const cached = overlayCacheRef.current.get(request.key);
      if (cached) {
        setOverlayData((prev) =>
          prev.flood === cached
            ? prev
            : {
                ...prev,
                flood: cached,
              },
        );
        return;
      }

      if (floodRequestKeyRef.current === request.key) {
        return;
      }

      floodRequestKeyRef.current = request.key;

      void fetch(request.url)
        .then(async (response) => {
          const payload = (await response.json()) as OverlayApiResponse;
          if (payload.error) {
            throw new Error(payload.error);
          }

          overlayCacheRef.current.set(request.key, payload.data);

          if (floodViewportKeyRef.current !== request.key) {
            return;
          }

          setOverlayData((prev) => ({
            ...prev,
            flood: payload.data,
          }));
        })
        .catch((error: unknown) => {
          console.warn("Overlay flood failed", error);
        })
        .finally(() => {
          if (floodRequestKeyRef.current === request.key) {
            floodRequestKeyRef.current = null;
          }
        });
    };

    syncFloodOverlay();
    map.on("moveend", syncFloodOverlay);

    return () => {
      map.off("moveend", syncFloodOverlay);
    };
  }, [activeOverlaySet]);

  // ── Sync GeoJSON overlays with the current map style ─────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sync = () => {
      syncMapOverlays(map, activeOverlaySet, overlayData);
    };

    map.on("styledata", sync);

    if (map.isStyleLoaded()) {
      sync();
    }

    return () => {
      map.off("styledata", sync);
    };
  }, [activeLayer.id, activeOverlaySet, overlayData]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      aria-label="Portland incident map"
    />
  );
}

const ALL_OVERLAY_IDS = MAP_OVERLAYS.map((overlay) => overlay.id);

function buildFloodOverlayRequest(
  map: maplibregl.Map,
): { key: string; url: string } | null {
  const zoom = map.getZoom();

  if (zoom < FLOOD_OVERLAY_MIN_ZOOM) {
    return null;
  }

  const bounds = map.getBounds();
  const bbox = [
    snapCoordinate(bounds.getWest(), FLOOD_OVERLAY_BBOX_PRECISION),
    snapCoordinate(bounds.getSouth(), FLOOD_OVERLAY_BBOX_PRECISION),
    snapCoordinate(bounds.getEast(), FLOOD_OVERLAY_BBOX_PRECISION),
    snapCoordinate(bounds.getNorth(), FLOOD_OVERLAY_BBOX_PRECISION),
  ];
  const bboxParam = bbox.join(",");
  const zoomBucket = Math.max(
    FLOOD_OVERLAY_MIN_ZOOM,
    Math.floor(zoom),
  );

  return {
    key: `flood:${bboxParam}:${zoomBucket}`,
    url: `/api/overlays/flood?bbox=${encodeURIComponent(bboxParam)}&zoom=${zoomBucket}`,
  };
}

function snapCoordinate(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function syncMapOverlays(
  map: maplibregl.Map,
  activeOverlayIds: Set<MapOverlayId>,
  overlayData: Partial<Record<MapOverlayId, OverlayFeatureCollection>>,
) {
  for (const overlayId of ALL_OVERLAY_IDS) {
    const data = overlayData[overlayId];

    if (!activeOverlayIds.has(overlayId) || !data) {
      removeOverlay(map, overlayId);
      continue;
    }

    const sourceId = getOverlaySourceId(overlayId);
    const existingSource = map.getSource(sourceId) as
      | maplibregl.GeoJSONSource
      | undefined;

    if (existingSource) {
      existingSource.setData(data as never);
    } else {
      map.addSource(sourceId, {
        type: "geojson",
        data: data as never,
      });
    }

    ensureOverlayLayers(map, overlayId, sourceId);
  }
}

function ensureOverlayLayers(
  map: maplibregl.Map,
  overlayId: MapOverlayId,
  sourceId: string,
) {
  if (overlayId === "cip") {
    ensureLayer(map, {
      id: getOverlayLayerId(overlayId, "fill"),
      type: "fill",
      source: sourceId,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "fill-color": "#c2410c",
        "fill-opacity": 0.12,
      },
    });
    ensureLayer(map, {
      id: getOverlayLayerId(overlayId, "line"),
      type: "line",
      source: sourceId,
      filter: ["==", ["geometry-type"], "LineString"],
      paint: {
        "line-color": "#c2410c",
        "line-width": 3,
        "line-opacity": 0.85,
      },
    });
    ensureLayer(map, {
      id: getOverlayLayerId(overlayId, "point"),
      type: "circle",
      source: sourceId,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-color": "#c2410c",
        "circle-radius": 4.5,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#ffffff",
      },
    });
    return;
  }

  if (overlayId === "flood") {
    ensureLayer(map, {
      id: getOverlayLayerId(overlayId, "fill"),
      type: "fill",
      source: sourceId,
      paint: {
        "fill-color": "#0369a1",
        "fill-opacity": 0.14,
      },
    });
    ensureLayer(map, {
      id: getOverlayLayerId(overlayId, "line"),
      type: "line",
      source: sourceId,
      paint: {
        "line-color": "#0369a1",
        "line-width": 1.5,
        "line-opacity": 0.4,
      },
    });
    return;
  }

  if (overlayId === "streetwork") {
    ensureLayer(map, {
      id: getOverlayLayerId(overlayId, "fill"),
      type: "fill",
      source: sourceId,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "fill-color": "#92400e",
        "fill-opacity": 0.1,
      },
    });
    ensureLayer(map, {
      id: getOverlayLayerId(overlayId, "line"),
      type: "line",
      source: sourceId,
      filter: ["==", ["geometry-type"], "LineString"],
      paint: {
        "line-color": "#92400e",
        "line-width": 2.5,
        "line-opacity": 0.85,
      },
    });
    ensureLayer(map, {
      id: getOverlayLayerId(overlayId, "point"),
      type: "circle",
      source: sourceId,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-color": "#92400e",
        "circle-radius": 4.5,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#ffffff",
      },
    });
    return;
  }

  if (overlayId === "highcrash") {
    ensureLayer(map, {
      id: getOverlayLayerId(overlayId, "point"),
      type: "circle",
      source: sourceId,
      paint: {
        "circle-color": "#b91c1c",
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["coalesce", ["to-number", ["get", "rank"]], 30],
          1,
          8,
          30,
          4.5,
        ],
        "circle-opacity": 0.85,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#ffffff",
      },
    });
    return;
  }

  if (overlayId === "highcrashstreets") {
    ensureLayer(map, {
      id: getOverlayLayerId(overlayId, "line"),
      type: "line",
      source: sourceId,
      paint: {
        "line-color": "#0f766e",
        "line-width": 3,
        "line-opacity": 0.85,
      },
    });
    return;
  }

  if (overlayId === "emergencyroutes") {
    ensureLayer(map, {
      id: getOverlayLayerId(overlayId, "line"),
      type: "line",
      source: sourceId,
      paint: {
        "line-color": "#7f1d1d",
        "line-width": 3,
        "line-opacity": 0.85,
      },
    });
    return;
  }

  if (overlayId === "potholes") {
    ensureLayer(map, {
      id: getOverlayLayerId(overlayId, "point"),
      type: "circle",
      source: sourceId,
      paint: {
        "circle-color": [
          "match",
          ["get", "status"],
          "In Progress",
          "#b45309",
          "#7c2d12",
        ],
        "circle-radius": 4.5,
        "circle-opacity": 0.9,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#ffffff",
      },
    });
    return;
  }

  if (overlayId === "airquality") {
    ensureLayer(map, {
      id: getOverlayLayerId(overlayId, "fill"),
      type: "fill",
      source: sourceId,
      paint: {
        "fill-color": [
          "match",
          ["coalesce", ["to-number", ["get", "gridCode"]], 1],
          1,
          "#00e400",
          2,
          "#ffff00",
          3,
          "#ff7e00",
          4,
          "#ff0000",
          5,
          "#99004c",
          6,
          "#4c0026",
          "#9ca3af",
        ],
        "fill-opacity": 0.14,
      },
    });
    ensureLayer(map, {
      id: getOverlayLayerId(overlayId, "line"),
      type: "line",
      source: sourceId,
      paint: {
        "line-color": [
          "match",
          ["coalesce", ["to-number", ["get", "gridCode"]], 1],
          1,
          "#16a34a",
          2,
          "#ca8a04",
          3,
          "#ea580c",
          4,
          "#dc2626",
          5,
          "#a21caf",
          6,
          "#6b213f",
          "#6b7280",
        ],
        "line-width": 1.5,
        "line-opacity": 0.55,
      },
    });
    return;
  }

  ensureLayer(map, {
    id: getOverlayLayerId(overlayId, "point"),
    type: "circle",
    source: sourceId,
    paint: {
      "circle-color": "#15803d",
      "circle-radius": 6,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });
}

function removeOverlay(map: maplibregl.Map, overlayId: MapOverlayId) {
  const sourceId = getOverlaySourceId(overlayId);
  for (const suffix of ["fill", "line", "point"]) {
    const layerId = getOverlayLayerId(overlayId, suffix);
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
  }

  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
}

function ensureLayer(
  map: maplibregl.Map,
  layer: maplibregl.LayerSpecification,
) {
  if (!map.getLayer(layer.id)) {
    map.addLayer(layer);
  }
}

function getOverlaySourceId(id: MapOverlayId): string {
  return `overlay-${id}`;
}

function getOverlayLayerId(id: MapOverlayId, suffix: string): string {
  return `${getOverlaySourceId(id)}-${suffix}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildStyleFromLayer(layer: LayerStyle): maplibregl.StyleSpecification {
  // Build a MapLibre style spec from a raster tile URL
  return {
    version: 8,
    sources: {
      "raster-tiles": {
        type: "raster",
        tiles: [
          layer.tileUrl.replace("{s}", "a").replace("{r}", ""),
          layer.tileUrl.replace("{s}", "b").replace("{r}", ""),
          layer.tileUrl.replace("{s}", "c").replace("{r}", ""),
        ],
        tileSize: 256,
        attribution: layer.attribution,
      },
    },
    layers: [
      {
        id: "background",
        type: "raster",
        source: "raster-tiles",
      },
    ],
    // Needed to suppress the unused variable warning
    glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
    sprite: "",
  } as unknown as maplibregl.StyleSpecification;
}

function createMarkerElement(event: IncidentEvent): HTMLElement {
  const el = document.createElement("div");
  el.className = "pdx-marker";
  el.setAttribute("data-id", event.id);
  el.setAttribute("data-category", event.category);
  el.title = event.title;

  el.style.cssText = `
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
  `;

  const pin = document.createElement("div");
  pin.setAttribute("aria-hidden", "true");
  pin.style.cssText = `
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: ${categoryColor(event.category)};
    border: 2.5px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    transform-origin: center center;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    will-change: transform;
  `;
  pin.innerHTML = getCategoryIconSvg(event.category);
  el.appendChild(pin);

  el.addEventListener("mouseenter", () => {
    pin.style.transform = "scale(1.2)";
    pin.style.boxShadow = "0 4px 12px rgba(0,0,0,0.35)";
    el.style.zIndex = "10";
  });
  el.addEventListener("mouseleave", () => {
    pin.style.transform = "scale(1)";
    pin.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
    el.style.zIndex = "1";
  });

  return el;
}

function createSearchMarkerElement(): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = `
    width: 18px;
    height: 18px;
    border-radius: 9999px;
    background: #111827;
    border: 3px solid white;
    box-shadow: 0 2px 10px rgba(0,0,0,0.28);
  `;
  return el;
}

function getCategoryIconSvg(category: string): string {
  const paths: Record<string, string> = {
    police: `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>`,
    fire: `<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>`,
    weather: `<path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/>`,
    transit: `<path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>`,
    bridge: `<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>`,
    road: `<rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/><path d="M10 14 2.3 6.3"/><path d="m14 6 7.7 7.7"/><path d="m8 6 8 8"/>`,
    health: `<path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>`,
    waterworks: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>`,
    advisories: `<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>`,
  };
  const pathData = paths[category] ?? `<circle cx="12" cy="12" r="4"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${pathData}</svg>`;
}

function buildPopupHTML(event: IncidentEvent): string {
  const color = categoryColor(event.category);
  const time = new Date(event.timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return `
    <div style="font-family: system-ui, sans-serif; min-width: 200px;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
        <span style="
          display:inline-block;
          width:10px; height:10px;
          border-radius:50%;
          background:${color};
          flex-shrink:0;
        "></span>
        <strong style="font-size:14px; line-height:1.3;">${escapeHtml(event.title)}</strong>
      </div>
      ${event.address ? `<p style="margin:0 0 6px; font-size:12px; color:#555;">${escapeHtml(event.address)}</p>` : ""}
      ${event.description ? `<p style="margin:0 0 8px; font-size:12px; color:#333;">${escapeHtml(event.description.slice(0, 150))}</p>` : ""}
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#888;">
        <span>${time}</span>
        ${event.sourceUrl ? `<a href="${event.sourceUrl}" target="_blank" rel="noopener noreferrer" style="color:#e85d3c; text-decoration:none;">Source →</a>` : ""}
      </div>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
