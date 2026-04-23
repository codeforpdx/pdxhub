# PDX Hub — Portland Live Map

Real-time public data for Portland, OR on an interactive map. Aggregates police/fire dispatch, NWS weather alerts, TriMet transit alerts, bridge lifts, road closures, water advisories, and nine GIS safety overlays from City of Portland open data sources.
<img width="1864" height="1287" alt="Screenshot 2026-04-08 at 4 52 59 PM" src="https://github.com/user-attachments/assets/4c2756b9-e9a9-442a-8b9b-3a50ab88695b" />

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Map:** MapLibre GL JS
- **Data fetching:** SWR (client polling) + Next.js ISR (server-side overlay caching)
- **Styling:** Tailwind CSS v4
- **Runtime:** Bun (recommended) or Node.js 20+

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.0+ **or** Node.js 20+
- Git

### 1. Clone and install

```bash
git clone https://github.com/Jared-Krajewski/pdxHub.git
cd pdxHub
bun install        # or: npm install
```

### 2. Set up environment variables

Copy the example file:

```bash
cp .env.example .env.local
```

Then fill in `.env.local`. See **Environment Variables** below for where to get each value.

### 3. Run the development server

```bash
bun dev            # or: npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Run with Docker Compose

All Docker workflows are managed through `make`. Run `make help` from the project root to see available targets.

#### Production container

```bash
make build   # build the production image
make run     # start the production container (foreground)
make up      # build then start in one step
```

#### Development container with live reload

```bash
make dev
```

Starts the dev container in Docker Compose watch mode. Source changes are synced into the container and Next.js hot-reloads. Changes to `package.json` trigger a full image rebuild.

Approximate image sizes:

- `pdx-hub:local` production image ~288 MB
- `pdx-hub:dev` development image ~1.3 GB (carries full deps + tooling)

Both modes publish the app on [http://localhost:3000](http://localhost:3000) and load `.env.local` automatically when that file exists.

#### Cleanup

| Command        | What it does                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `make stop`    | Pause containers without removing them                                                                                                                                               |
| `make down`    | Remove project containers and network                                                                                                                                                |
| `make clean`   | Remove containers, network, named volumes, and local images                                                                                                                          |
| `make clobber` | Everything in `clean`, plus force-removes active BuildKit helper containers and their state volumes, then globally prunes unused Docker images, volumes, networks, and builder cache |

---

## Environment Variables

All variables are **optional** — the app runs without any of them, but will be missing data from APIs that require a key.

### `TRIMET_APP_ID` — TriMet transit alerts

Required for the **Transit Alerts** feed. Without it the transit route throws a 403.

1. Register at [developer.trimet.org](https://developer.trimet.org/appid/registration/) (free, instant)
2. Copy your App ID into `.env.local`

```env
TRIMET_APP_ID=your-app-id-here
```

### `TRIPCHECK_PRIMARY_KEY` — Oregon road incidents

Required for the **Road Closures** feed. Without it the road route returns an error.

1. Request access at [api.odot.state.or.us](https://api.odot.state.or.us) / TripCheck developer portal (free)
2. Copy your subscription key into `.env.local`

```env
TRIPCHECK_PRIMARY_KEY=your-key-here
```

### `SOCRATA_APP_TOKEN` — Portland Open Data rate limits

Optional. Without it the **Bridge Lifts** feed works but is rate-limited to ~1,000 requests/day across all anonymous callers.

1. Register at [data.portlandoregon.gov](https://data.portlandoregon.gov/) → Developer Settings (free)
2. Create an app token and copy it into `.env.local`

```env
SOCRATA_APP_TOKEN=your-token-here
```

## Project Structure

```
src/
  app/
    page.tsx              # Root page — renders HomeClient
    layout.tsx            # App shell, metadata, PWA manifest
    globals.css           # Tailwind + MapLibre CSS, design tokens
    api/
      police/             # Portland 911 dispatch (police)
      fire/               # Portland 911 dispatch (fire)
      weather/            # NWS alerts (api.weather.gov)
      transit/            # TriMet service alerts
      bridge/             # Portland bridge lift schedule (Socrata)
      road/               # Oregon TripCheck road incidents
      waterworks/         # Portland Water Bureau projects
      advisories/         # Oregon drinking water advisories (ArcGIS)
      health/             # Disabled — stub returns empty (no public API)
      overlays/           # GIS overlay routes (ISR-cached, ArcGIS Feature Services)
        airquality/       #   EPA AirNow AQI contours          — 30 min cache
        potholes/         #   PBOT active pothole reports       — 24 h cache
        streetwork/       #   PBOT active permit jobs           — 30 min cache
        cip/              #   City capital improvement projects — 24 h cache
        flood/            #   FEMA flood hazard areas           — 24 h cache
        beecn/            #   Earthquake communication nodes    — 24 h cache
        emergencyroutes/  #   Emergency transportation routes   — 24 h cache
        highcrash/        #   PBOT high-crash intersections     — 24 h cache
        highcrashstreets/ #   PBOT high-crash corridors         — 24 h cache
  components/
    HomeClient.tsx        # Root client component, all state lives here
    map/
      MapView.tsx         # MapLibre GL map, markers, popups, overlay layers
      FilterBar.tsx       # Category toggle pills
      LayerSwitcher.tsx   # Tile layer switcher (Street / Satellite)
      OverlaySwitcher.tsx # GIS overlay panel
      LocationSearch.tsx  # Nominatim geocoder
    sidebar/
      Sidebar.tsx         # Event feed, date filter
      FeedCard.tsx        # Individual incident card
  hooks/
    useEvents.ts          # SWR polling for all incident routes
  lib/
    constants.ts          # Map defaults, category filters, overlay configs
    normalizers.ts        # Raw API data → IncidentEvent[]
    arcgis.ts             # Paginated ArcGIS FeatureServer fetcher
    portland911.ts        # Portland Maps Atom/XML dispatch feed parser
  types/
    index.ts              # Shared TypeScript types

public/
  manifest.json           # PWA manifest
  sw.js                   # Service worker (production only)
```

---

## Other Commands

```bash
bun run build      # Production build
bun run start      # Run production build locally
bun run lint       # ESLint
bun run clean-dev  # Kill existing dev server, wipe .next cache, restart
make up            # Build and start the Dockerized app
make dev           # Start the live-reload dev container
make stop          # Stop running containers without removing them
make clean         # Remove project containers, volumes, and images
make clobber       # Full Docker cleanup including BuildKit state (global, destructive)
```

---

## Data Sources

| Feed                   | Source                                                                                  | Requires key |
| ---------------------- | --------------------------------------------------------------------------------------- | :----------: |
| Police / Fire dispatch | [Portland Maps 911 feed](https://www.portlandmaps.com/scripts/911incidents.cfm)         |      No      |
| Weather alerts         | [api.weather.gov](https://api.weather.gov/)                                             |      No      |
| Bridge lifts           | [Portland Open Data (Socrata)](https://data.portlandoregon.gov/resource/s93p-i6s8.json) |   Optional   |
| Transit alerts         | [TriMet REST API](https://developer.trimet.org/ws_docs/)                                |     Yes      |
| Road incidents         | [Oregon TripCheck](https://www.tripcheck.com/)                                          |     Yes      |
| Water projects         | [Portland Water Bureau](https://www.portland.gov/api/waterworks)                        |      No      |
| Water advisories       | [Oregon DEQ ArcGIS](https://services.arcgis.com/uUvqNMGPm7axC2dD/)                      |      No      |
| GIS overlays           | [Portland Maps Open Data](https://www.portlandmaps.com/od/rest/services/)               |      No      |
| Air quality            | [EPA AirNow ArcGIS](https://services.arcgis.com/cJ9YHowT8TU7DUyn/)                      |      No      |
| Location search        | [Nominatim / OpenStreetMap](https://nominatim.openstreetmap.org/)                       |      No      |

---

## PWA

The app ships a service worker (`public/sw.js`) that is only registered in production builds. In development the service worker is automatically unregistered to prevent stale chunk errors.
