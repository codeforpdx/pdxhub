"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type {
  CategoryFilter,
  IncidentEvent,
  LayerStyle,
  MapOverlayId,
} from "@/types";
import {
  CATEGORY_FILTERS,
  DEFAULT_MAP_LAYER_ID,
  MAP_LAYERS,
  MAP_OVERLAYS,
} from "@/lib/constants";
import Sidebar from "@/components/sidebar/Sidebar";
import FilterBar from "@/components/map/FilterBar";
import LayerSwitcher from "@/components/map/LayerSwitcher";
import OverlaySwitcher from "@/components/map/OverlaySwitcher";
import LocationSearch, { type Location } from "@/components/map/LocationSearch";
import { useEvents } from "@/hooks/useEvents";
import MapView from "@/components/map/MapView";

export default function HomeClient() {
  const [filters, setFilters] = useState<CategoryFilter[]>(CATEGORY_FILTERS);
  const [activeLayerId, setActiveLayerId] = useState(DEFAULT_MAP_LAYER_ID);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [flyToLocation, setFlyToLocation] = useState<Location | null>(null);
  const [activeOverlayIds, setActiveOverlayIds] = useState<MapOverlayId[]>([]);

  const { events, loading, refreshing, hasSettled, error } = useEvents();
  const activeLayer =
    MAP_LAYERS.find((l) => l.id === activeLayerId) ?? MAP_LAYERS[0];
  const enabledCategoryIds = useMemo(
    () =>
      new Set(
        filters.filter((filter) => filter.enabled).map((filter) => filter.id),
      ),
    [filters],
  );
  const activeSelectedEventId = useMemo(() => {
    if (!selectedEventId) {
      return undefined;
    }

    const selectedEvent = events.find((event) => event.id === selectedEventId);
    return selectedEvent && enabledCategoryIds.has(selectedEvent.category)
      ? selectedEventId
      : undefined;
  }, [enabledCategoryIds, events, selectedEventId]);
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const event of events) {
      if (enabledCategoryIds.has(event.category)) {
        counts[event.category] = (counts[event.category] ?? 0) + 1;
      }
    }
    return counts;
  }, [enabledCategoryIds, events]);

  const handleToggleFilter = useCallback(
    (id: CategoryFilter["id"]) => {
      const currentFilter = filters.find((filter) => filter.id === id);
      const currentSelectedEvent = activeSelectedEventId
        ? events.find((event) => event.id === activeSelectedEventId)
        : undefined;

      setFilters((prev) =>
        prev.map((filter) =>
          filter.id === id ? { ...filter, enabled: !filter.enabled } : filter,
        ),
      );

      if (currentFilter?.enabled && currentSelectedEvent?.category === id) {
        setSelectedEventId(undefined);
      }
    },
    [activeSelectedEventId, events, filters],
  );

  const handleEventSelect = useCallback((event: IncidentEvent) => {
    setSelectedEventId(event.id);
    // On mobile, close sidebar so user can see the map
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  const handleLayerChange = useCallback((layer: LayerStyle) => {
    setActiveLayerId(layer.id);
  }, []);

  const handleToggleOverlay = useCallback((id: MapOverlayId) => {
    setActiveOverlayIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  // Register service worker for PWA
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV !== "production") {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            void registration.unregister();
          });
        });

        if ("caches" in window) {
          caches.keys().then((keys) => {
            keys.forEach((key) => {
              void caches.delete(key);
            });
          });
        }

        return;
      }

      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("SW registration failed:", err));
    }
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      {sidebarOpen && (
        <Sidebar
          events={events}
          filters={filters}
          loading={loading}
          refreshing={refreshing}
          hasSettled={hasSettled}
          error={error}
          selectedEventId={activeSelectedEventId}
          onEventSelect={handleEventSelect}
        />
      )}

      {/* Map area */}
      <div className="relative flex-1 h-full overflow-hidden">
        {/* Top map toolbar — two rows */}
        <div className="absolute top-3 left-3 right-3 z-10 flex flex-col gap-2 pointer-events-none">
          {/* Row 1: sidebar toggle | location search (center) | layer switcher */}
          <div className="flex items-center gap-2">
            {/* Sidebar toggle */}
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className="pointer-events-auto flex items-center justify-center w-9 h-9 bg-white border border-border rounded-lg shadow-sm hover:bg-gray-50 transition-colors shrink-0"
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              title={sidebarOpen ? "Hide feed" : "Show feed"}
            >
              <span className="text-xs font-bold text-foreground">
                {sidebarOpen ? "◀" : "▶"}
              </span>
            </button>

            {/* Location search — takes remaining space */}
            <div className="pointer-events-auto flex-1">
              <LocationSearch
                onLocationSelect={setFlyToLocation}
                onLocationClear={() => setFlyToLocation(null)}
              />
            </div>

            {/* Layer switcher */}
            <div className="pointer-events-auto shrink-0">
              <LayerSwitcher
                activeLayerId={activeLayerId}
                onLayerChange={handleLayerChange}
              />
            </div>

            <div className="pointer-events-auto shrink-0">
              <OverlaySwitcher
                overlays={MAP_OVERLAYS}
                activeOverlayIds={activeOverlayIds}
                onToggle={handleToggleOverlay}
              />
            </div>
          </div>

          {/* Row 2: category filter chips (left-aligned) */}
          <div className="pointer-events-auto self-start">
            <FilterBar
              filters={filters}
              onToggle={handleToggleFilter}
              counts={categoryCounts}
            />
          </div>
        </div>

        {/* Map */}
        <MapView
          events={events}
          activeLayer={activeLayer}
          filters={filters}
          onEventSelect={handleEventSelect}
          selectedEventId={activeSelectedEventId}
          flyToLocation={flyToLocation}
          activeOverlayIds={activeOverlayIds}
        />

        {events.length === 0 && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-white/92 px-4 py-2 text-xs text-foreground shadow-lg backdrop-blur-sm">
            {loading && !hasSettled
              ? "Loading map and live feeds…"
              : error
                ? "Basemap loaded. Live feeds are still resolving."
                : "Basemap loaded. Waiting for live incidents."}
          </div>
        )}
      </div>
    </div>
  );
}
