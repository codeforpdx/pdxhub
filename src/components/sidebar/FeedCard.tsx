"use client";

import type { IncidentEvent } from "@/types";
import { categoryColor, categoryLabel } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";
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

interface FeedCardProps {
  event: IncidentEvent;
  isSelected: boolean;
  onClick: () => void;
}

const CATEGORY_ICONS: Record<string, ElementType<LucideProps>> = {
  police: Shield,
  fire: Flame,
  weather: CloudLightning,
  transit: Bus,
  bridge: ArrowUpDown,
  road: Construction,
  health: Stethoscope,
  waterworks: Wrench,
  advisories: Droplets,
};

export default function FeedCard({
  event,
  isSelected,
  onClick,
}: FeedCardProps) {
  const Icon = CATEGORY_ICONS[event.category] ?? Shield;
  const color = categoryColor(event.category);
  const label = categoryLabel(event.category);

  let timeAgo = "";
  try {
    timeAgo = formatDistanceToNow(new Date(event.timestamp), {
      addSuffix: true,
    });
  } catch {
    timeAgo = "recently";
  }

  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full text-left px-4 py-3.5 border-b border-border",
        "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        isSelected
          ? "bg-orange-50 border-l-4 border-l-accent"
          : "bg-white hover:bg-gray-50 border-l-4 border-l-transparent",
      )}
      aria-pressed={isSelected}
    >
      <div className="flex items-start gap-3">
        {/* Category icon dot */}
        <div
          className="flex items-center justify-center rounded-full shrink-0 mt-0.5"
          style={{
            width: 32,
            height: 32,
            backgroundColor: `${color}18`,
          }}
        >
          <Icon size={15} style={{ color }} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Category badge + time */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <span
              className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${color}18`, color }}
            >
              {label}
            </span>
            <span className="text-[11px] text-muted shrink-0">{timeAgo}</span>
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold leading-snug text-foreground truncate">
            {event.title}
          </h3>

          {/* Address / description */}
          {event.address && (
            <p className="text-xs text-muted mt-0.5 truncate">
              {event.address}
            </p>
          )}
          {!event.address && event.description && (
            <p className="text-xs text-muted mt-0.5 line-clamp-2">
              {event.description}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
