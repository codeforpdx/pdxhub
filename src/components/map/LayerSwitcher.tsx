"use client";

import { MAP_LAYERS } from "@/lib/constants";
import type { LayerStyle } from "@/types";
import { clsx } from "clsx";
import { Layers } from "lucide-react";
import { useState } from "react";

interface LayerSwitcherProps {
  activeLayerId: string;
  onLayerChange: (layer: LayerStyle) => void;
}

export default function LayerSwitcher({
  activeLayerId,
  onLayerChange,
}: LayerSwitcherProps) {
  const [open, setOpen] = useState(false);
  const activeLayer =
    MAP_LAYERS.find((l) => l.id === activeLayerId) ?? MAP_LAYERS[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium",
          "bg-white border border-border shadow-sm",
          "hover:bg-gray-50 transition-colors",
          open && "ring-2 ring-accent",
        )}
        aria-label="Switch map layer"
        aria-expanded={open}
      >
        <Layers size={15} />
        <span>{activeLayer.label}</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-full mt-1.5 z-40 bg-white border border-border rounded-lg shadow-lg overflow-hidden min-w-35">
            {MAP_LAYERS.map((layer) => (
              <button
                key={layer.id}
                onClick={() => {
                  onLayerChange(layer);
                  setOpen(false);
                }}
                className={clsx(
                  "w-full text-left px-4 py-2.5 text-sm transition-colors",
                  layer.id === activeLayerId
                    ? "bg-accent text-white font-medium"
                    : "hover:bg-gray-50 text-foreground",
                )}
              >
                {layer.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
