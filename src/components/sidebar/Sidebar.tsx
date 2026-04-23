"use client";

import type { CategoryFilter, IncidentEvent } from "@/types";
import FeedCard from "./FeedCard";
import { useMemo, useState } from "react";
import { RefreshCw, AlertCircle, Calendar } from "lucide-react";

interface DateRange {
  from: string; // ISO date string yyyy-mm-dd, empty means no bound
  to: string;
}

interface SidebarProps {
  events: IncidentEvent[];
  filters: CategoryFilter[];
  loading: boolean;
  refreshing: boolean;
  hasSettled: boolean;
  error?: string;
  selectedEventId?: string;
  onEventSelect: (event: IncidentEvent) => void;
}

export default function Sidebar({
  events,
  filters,
  loading,
  refreshing,
  hasSettled,
  error,
  selectedEventId,
  onEventSelect,
}: SidebarProps) {
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });
  const [rangeOpen, setRangeOpen] = useState(false);

  const enabledCategoryIds = useMemo(
    () => filters.filter((f) => f.enabled).map((f) => f.id),
    [filters],
  );

  const filteredEvents = useMemo(() => {
    const enabledCategories = new Set(enabledCategoryIds);
    const fromMs = dateRange.from ? new Date(dateRange.from).getTime() : 0;
    // "to" date is treated as end-of-day
    const toMs = dateRange.to
      ? new Date(dateRange.to).getTime() + 86_399_999
      : Infinity;

    return events
      .filter((e) => {
        if (!enabledCategories.has(e.category)) return false;
        const t = new Date(e.timestamp).getTime();
        return t >= fromMs && t <= toMs;
      })
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
  }, [events, enabledCategoryIds, dateRange]);

  const hasDateFilter = Boolean(dateRange.from || dateRange.to);
  const clearDateRange = () => setDateRange({ from: "", to: "" });

  const eventCount = filteredEvents.length;
  const failedSources = error ? [error] : [];
  const showUnavailableState =
    hasSettled && eventCount === 0 && failedSources.length > 0;
  const showAllClearState =
    hasSettled && eventCount === 0 && failedSources.length === 0;

  return (
    <aside className="flex flex-col h-full bg-surface border-r border-border w-(--sidebar-width)">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-foreground leading-none">
              PDX Hub
            </h1>
            <p className="mt-0.5 text-[11px] text-muted">
              Portland Live Incidents
            </p>
          </div>
          {refreshing && (
            <RefreshCw size={14} className="animate-spin text-muted" />
          )}
        </div>
      </div>

      {/* Date range filter */}
      <div className="px-3 py-2 border-b border-border">
        <button
          onClick={() => setRangeOpen((o) => !o)}
          className="flex items-center gap-1.5 w-full text-left text-xs text-muted hover:text-foreground transition-colors"
        >
          <Calendar size={12} />
          <span className="font-medium">Date range</span>
          {hasDateFilter && (
            <span className="ml-auto text-[10px] text-blue-600 font-medium">
              active
            </span>
          )}
          <span className="ml-auto text-[10px] text-muted">
            {rangeOpen ? "▲" : "▼"}
          </span>
        </button>

        {rangeOpen && (
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-muted w-6 shrink-0">
                From
              </label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) =>
                  setDateRange((r) => ({ ...r, from: e.target.value }))
                }
                className="flex-1 text-xs border border-border rounded px-2 py-1 bg-background text-foreground"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-muted w-6 shrink-0">To</label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) =>
                  setDateRange((r) => ({ ...r, to: e.target.value }))
                }
                className="flex-1 text-xs border border-border rounded px-2 py-1 bg-background text-foreground"
              />
            </div>
            {hasDateFilter && (
              <button
                onClick={clearDateRange}
                className="text-[10px] text-red-500 hover:text-red-700 text-right"
              >
                Clear filter
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-3 mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Feed list */}
      <div className="flex-1 overflow-y-auto sidebar-scroll">
        {loading && !hasSettled && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <p className="text-sm font-medium text-foreground">
              Loading live feeds
            </p>
            <p className="mt-1 text-xs text-muted">
              The map paints first, then each source fills in as it responds.
            </p>
          </div>
        )}

        {showUnavailableState && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <p className="text-sm font-medium text-foreground">
              Live feeds unavailable
            </p>
            <p className="mt-1 text-xs text-muted">
              Available sources responded, but none returned mappable incidents.
            </p>
          </div>
        )}

        {showAllClearState && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <p className="text-sm font-medium text-foreground">
              No incidents found
            </p>
            <p className="mt-1 text-xs text-muted">
              All clear — no active incidents for selected filters
            </p>
          </div>
        )}

        {filteredEvents.map((event) => (
          <FeedCard
            key={event.id}
            event={event}
            isSelected={event.id === selectedEventId}
            onClick={() => onEventSelect(event)}
          />
        ))}
      </div>

      {/* Data age disclaimer */}
      <div className="border-t border-border bg-background px-4 py-2.5">
        <p className="text-[10px] leading-relaxed text-muted">
          Live sources include Portland Maps 911, NWS, TriMet, Oregon TripCheck,
          Portland Water Bureau, and Oregon Drinking Water Services.
        </p>
      </div>
    </aside>
  );
}
