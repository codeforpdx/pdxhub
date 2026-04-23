"use client";

import type { MapOverlayConfig, MapOverlayId } from "@/types";
import { clsx } from "clsx";
import { ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";

interface OverlaySwitcherProps {
  overlays: MapOverlayConfig[];
  activeOverlayIds: MapOverlayId[];
  onToggle: (id: MapOverlayId) => void;
}

export default function OverlaySwitcher({
  overlays,
  activeOverlayIds,
  onToggle,
}: OverlaySwitcherProps) {
  const [open, setOpen] = useState(false);
  const activeCount = activeOverlayIds.length;
  const activeSet = useMemo(
    () => new Set(activeOverlayIds),
    [activeOverlayIds],
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className={clsx(
          "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium",
          "bg-white border border-border shadow-sm",
          "hover:bg-gray-50 transition-colors",
          open && "ring-2 ring-accent",
        )}
        aria-label="Toggle safety overlays"
        aria-expanded={open}
      >
        <ShieldAlert size={15} />
        <span>Overlays</span>
        {activeCount > 0 && (
          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed right-2 top-16 z-40 w-80 max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-80px)] rounded-lg border border-border bg-white shadow-lg flex flex-col"
            style={{
              // 64px = approx nav height, 80px = nav + margin
              // fallback for environments without Tailwind JIT
              top: 64,
              right: 8,
              maxHeight: "calc(100vh - 80px)",
            }}
          >
            <div className="border-b border-border px-4 py-3 shrink-0">
              <p className="text-sm font-semibold text-foreground">
                Safety overlays
              </p>
              <p className="mt-1 text-xs text-muted">
                Context layers for preparedness and city activity.
              </p>
            </div>
            <div className="overflow-y-auto py-1 flex-1 min-h-0">
              {overlays.map((overlay) => {
                const enabled = activeSet.has(overlay.id);
                return (
                  <button
                    key={overlay.id}
                    onClick={() => onToggle(overlay.id)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                    aria-pressed={enabled}
                  >
                    <span
                      className="mt-0.5 h-3 w-3 shrink-0 rounded-full border border-white/60 shadow-sm"
                      style={{ backgroundColor: overlay.color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">
                        {overlay.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                        {overlay.description}
                      </span>
                    </span>
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        enabled
                          ? "bg-accent/10 text-accent"
                          : "bg-gray-100 text-muted",
                      )}
                    >
                      {enabled ? "On" : "Off"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
