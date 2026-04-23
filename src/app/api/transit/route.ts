import { NextResponse } from "next/server";
import type { ApiResponse, IncidentEvent, TriMetAlert } from "@/types";
import { normalizeTransitAlerts } from "@/lib/normalizers";

// TriMet Service Alerts via their REST API.
// A registered AppID is required for all service calls.
// Docs: https://developer.trimet.org/ws_docs/
const TRIMET_ALERTS_URL = "https://developer.trimet.org/ws/V2/alerts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RawTriMetRoute {
  route_id?: string;
  id?: string | number;
  route?: string | number;
}

interface RawTriMetAlert {
  id?: string | number;
  alertId?: string | number;
  header_text?: string;
  headerText?: string;
  desc?: string;
  system_wide_flag?: boolean;
  begin?: number;
  end?: number;
  route?: RawTriMetRoute[];
  info_link_url?: string;
  url?: string;
  location?: Array<{
    lat?: number;
    lng?: number;
  }>;
}

export async function GET() {
  try {
    const appId = process.env.TRIMET_APP_ID?.trim() ?? "";

    if (!appId) {
      throw new Error(
        "TriMet AppID is missing. Set TRIMET_APP_ID in .env.local with a registered developer.trimet.org AppID.",
      );
    }

    const params = new URLSearchParams({ appID: appId, json: "true" });

    const res = await fetch(`${TRIMET_ALERTS_URL}?${params}`, {
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      if (res.status === 403) {
        throw new Error(
          `TriMet rejected TRIMET_APP_ID \"${appId}\" with 403. Use a registered AppID from developer.trimet.org.`,
        );
      }

      throw new Error(`TriMet API responded ${res.status}`);
    }

    const raw = await res.json();

    // TriMet returns { resultSet: { alert: [...] } }
    const alerts: TriMetAlert[] = (raw?.resultSet?.alert ?? []).map(
      (a: RawTriMetAlert) => ({
        id: String(a.id ?? a.alertId ?? Math.random()),
        header_text: a.header_text ?? a.headerText ?? a.desc,
        description_text: a.desc,
        effect: a.system_wide_flag ? "SYSTEM_WIDE" : "ROUTE_CHANGE",
        start: a.begin,
        end: a.end,
        routes:
          a.route
            ?.map(
              (r: {
                route_id?: string;
                id?: string | number;
                route?: string | number;
              }) => String(r.route_id ?? r.id ?? r.route ?? ""),
            )
            .filter(Boolean) ?? [],
        url: a.info_link_url ?? a.url,
        lat: a.location?.[0]?.lat,
        lng: a.location?.[0]?.lng,
      }),
    );

    const data: IncidentEvent[] = normalizeTransitAlerts(alerts);

    const body: ApiResponse<IncidentEvent> = {
      data,
      fetchedAt: new Date().toISOString(),
      source: "TriMet",
    };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=30",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        data: [],
        fetchedAt: new Date().toISOString(),
        source: "TriMet",
        error: message,
      },
      { status: 200 },
    );
  }
}
