"use client";

import type { CategoryFilter } from "@/types";
import { clsx } from "clsx";
import {
  Shield,
  Flame,
  CloudLightning,
  Bus,
  ArrowUpDown,
  Construction,
  Stethoscope,
  Wrench,
  Droplets,
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ElementType } from "react";

interface FilterBarProps {
  filters: CategoryFilter[];
  onToggle: (id: CategoryFilter["id"]) => void;
  counts?: Record<string, number>;
}

const ICONS: Record<string, ElementType<LucideProps>> = {
  Shield,
  Flame,
  CloudLightning,
  Bus,
  ArrowUpDown,
  Construction,
  Stethoscope,
  Wrench,
  Droplets,
};

export default function FilterBar({
  filters,
  onToggle,
  counts = {},
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {filters.map((filter) => {
        const Icon = ICONS[filter.icon] ?? Shield;
        return (
          <button
            key={filter.id}
            onClick={() => onToggle(filter.id)}
            title={filter.staleNote ?? filter.label}
            className={clsx(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium",
              "border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
              filter.enabled
                ? "text-white border-transparent shadow-sm"
                : "bg-white text-muted border-border hover:border-gray-400",
            )}
            style={
              filter.enabled
                ? { backgroundColor: filter.color, borderColor: filter.color }
                : {}
            }
            aria-pressed={filter.enabled}
          >
            <Icon size={12} />
            <span className="hidden sm:inline">{filter.label}</span>
            {filter.enabled && (counts[filter.id] ?? 0) > 0 && (
              <span className="ml-0.5 font-semibold tabular-nums">
                {counts[filter.id]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
