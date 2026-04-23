"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Search, X, MapPin, Loader2 } from "lucide-react";
import { clsx } from "clsx";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}

export interface Location {
  lat: number;
  lng: number;
  displayName: string;
}

interface LocationSearchProps {
  onLocationSelect: (location: Location) => void;
  onLocationClear?: () => void;
}

// Portland bounding box for biased results
const PDX_VIEWBOX = "-122.8364,45.4289,-122.4790,45.6500";

export default function LocationSearch({
  onLocationSelect,
  onLocationClear,
}: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: `${q}, Portland, OR`,
        format: "json",
        limit: "6",
        viewbox: PDX_VIEWBOX,
        bounded: "0",
        countrycodes: "us",
        addressdetails: "0",
      });

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          headers: {
            "Accept-Language": "en",
            "User-Agent": "pdxhub.app/1.0",
          },
        },
      );

      if (!res.ok) throw new Error("Nominatim search failed");
      const data: NominatimResult[] = await res.json();
      setResults(data);
      setOpen(data.length > 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (result: NominatimResult) => {
    const short = result.display_name.split(",").slice(0, 2).join(",");
    setQuery(short);
    setOpen(false);
    setResults([]);
    onLocationSelect({
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      displayName: result.display_name,
    });
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setOpen(false);
    onLocationClear?.();
    inputRef.current?.focus();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div
        className={clsx(
          "flex items-center gap-2 px-3 py-2 rounded-xl",
          "bg-white border border-border shadow-md",
          "focus-within:ring-2 focus-within:ring-accent focus-within:border-transparent",
          "transition-shadow",
        )}
      >
        {loading ? (
          <Loader2 size={15} className="text-muted shrink-0 animate-spin" />
        ) : (
          <Search size={15} className="text-muted shrink-0" />
        )}
        <input
          ref={inputRef}
          type="text"
          placeholder="Search Portland locations…"
          value={query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="flex-1 text-sm bg-transparent placeholder:text-muted focus:outline-none min-w-0"
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            onClick={handleClear}
            className="text-muted hover:text-foreground transition-colors shrink-0"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-border rounded-xl shadow-lg overflow-hidden z-50 max-h-64 overflow-y-auto">
          {results.map((result) => {
            const parts = result.display_name.split(",");
            const primary = parts[0];
            const secondary = parts.slice(1, 3).join(",").trim();
            return (
              <button
                key={result.place_id}
                onClick={() => handleSelect(result)}
                className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-border last:border-0"
              >
                <MapPin size={14} className="shrink-0 mt-0.5 text-accent" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {primary}
                  </p>
                  {secondary && (
                    <p className="text-xs text-muted truncate">{secondary}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
