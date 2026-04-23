import type { IncidentEvent } from "@/types";

const PORTLAND_911_URL =
  "https://www.portlandmaps.com/scripts/911incidents.cfm";

type DispatchCategory = "police" | "fire";

interface DispatchFeedEntry {
  id: string;
  title: string;
  callType: string;
  address: string;
  agency: string;
  timestamp: string;
  lat: number;
  lng: number;
}

export async function fetchDispatchEvents(
  category: DispatchCategory,
): Promise<IncidentEvent[]> {
  const response = await fetch(PORTLAND_911_URL, {
    headers: {
      Accept: "application/atom+xml, application/xml, text/xml",
      "User-Agent": "PDX-Hub/1.0",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Portland 911 feed responded ${response.status}`);
  }

  const xml = await response.text();
  const entries = parseDispatchFeed(xml);

  return entries
    .filter((entry) => matchesCategory(entry.agency, category))
    .map((entry) => ({
      id: `${category}-${entry.id}`,
      category,
      severity: categorizeDispatchSeverity(entry.callType),
      title: entry.callType,
      description: `${entry.agency} dispatch`,
      address: entry.address,
      lat: entry.lat,
      lng: entry.lng,
      timestamp: entry.timestamp,
      source: "Portland Maps 911 Dispatch Feed",
      sourceUrl: PORTLAND_911_URL,
      raw: entry,
    }));
}

function parseDispatchFeed(xml: string): DispatchFeedEntry[] {
  const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/gi) ?? [];

  return entries.map((entry) => {
    const point = extractTag(entry, "georss:point");
    const [latText, lngText] = point.split(/\s+/);
    const contentHtml = decodeHtmlEntities(extractTag(entry, "content"));
    const contentValues = [
      ...contentHtml.matchAll(/<dd>([\s\S]*?)<\/dd>/gi),
    ].map((match) => stripHtml(match[1]));

    return {
      id: extractTag(entry, "id").split("/").pop() ?? extractTag(entry, "id"),
      title: extractTag(entry, "title"),
      callType:
        extractAttribute(entry, "category", "label") ||
        extractTag(entry, "title"),
      address:
        contentValues[2] ?? extractAddressFromTitle(extractTag(entry, "title")),
      agency:
        contentValues[3] ??
        extractAgencyFromSummary(extractTag(entry, "summary")),
      timestamp: extractTag(entry, "updated") || extractTag(entry, "published"),
      lat: Number.parseFloat(latText ?? "45.5231"),
      lng: Number.parseFloat(lngText ?? "-122.6765"),
    };
  });
}

function extractTag(xml: string, tag: string): string {
  const escapedTag = tag.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const match = xml.match(
    new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "i"),
  );
  return stripHtml(decodeHtmlEntities(match?.[1] ?? "")).trim();
}

function extractAttribute(xml: string, tag: string, attribute: string): string {
  const escapedTag = tag.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const escapedAttribute = attribute.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const match = xml.match(
    new RegExp(
      `<${escapedTag}[^>]*${escapedAttribute}="([^"]+)"[^>]*\/?>`,
      "i",
    ),
  );
  return decodeHtmlEntities(match?.[1] ?? "").trim();
}

function extractAddressFromTitle(title: string): string {
  const [, address = ""] = title.split(" at ");
  return address.trim();
}

function extractAgencyFromSummary(summary: string): string {
  const match = summary.match(/\[([^#\]]+?)\s+#/);
  return match?.[1]?.trim() ?? "Unknown agency";
}

function matchesCategory(agency: string, category: DispatchCategory): boolean {
  if (category === "police") {
    return /police|sheriff/i.test(agency);
  }

  return /fire|rescue|medical|ems|amr/i.test(agency);
}

function categorizeDispatchSeverity(
  callType: string,
): IncidentEvent["severity"] {
  const normalized = callType.toLowerCase();

  if (
    /shoot|stab|assault|robbery|rescue|hazmat|fire|alarm high/i.test(normalized)
  ) {
    return "critical";
  }

  if (/medical|duii|crash|burglary|theft|disturbance/i.test(normalized)) {
    return "high";
  }

  if (/welfare|suspicious|check|noise|traffic/i.test(normalized)) {
    return "medium";
  }

  return "low";
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
