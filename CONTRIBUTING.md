# Contributing to PDX Hub

Thank you for your interest in contributing to PDX Hub! This is a [Code PDX](https://www.codeforpdx.org/) open-source civic project. We welcome contributions from developers of all experience levels — whether you're fixing a typo, adding a new data overlay, or building a full feature.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Setting Up a Development Environment](#setting-up-a-development-environment)
- [Contribution Workflow](#contribution-workflow)
- [Coding Standards](#coding-standards)
- [Submitting Bug Reports and Feature Requests](#submitting-bug-reports-and-feature-requests)
- [Opening a Pull Request](#opening-a-pull-request)

---

## Code of Conduct

PDX Hub follows the [Code PDX Code of Conduct](https://github.com/codeforpdx/codeofconduct). By participating, you agree to abide by its terms. Be respectful and welcoming — this is a civic project that serves everyone.

---

## Setting Up a Development Environment

### Prerequisites

- [Bun](https://bun.sh/) v1.0+ **or** Node.js 20+  
- [Git](https://git-scm.com/)
- (Optional) [Docker](https://www.docker.com/) + [Docker Compose](https://docs.docker.com/compose/) for the containerized workflow

### 1. Clone the repository

If you are new to Git/GitHub, see [How to Create a Pull Request on GitHub](https://www.digitalocean.com/community/tutorials/how-to-create-a-pull-request-on-github) for a broad overview.

```bash
git clone https://github.com/codeforpdx/pdxhub.git
cd pdxhub
```

Verify the remote is set correctly:

```bash
git remote -v
# origin  https://github.com/codeforpdx/pdxhub.git
```

### 2. Install dependencies

```bash
bun install       # recommended
# or: npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in any API keys you need. All variables are **optional** — the app runs without them, but some data feeds will be missing. See the [Environment Variables](README.md#environment-variables) section in the README for where to obtain each key.

> **Never commit `.env.local`** — it is already in `.gitignore`.

### 4. Start the development server

```bash
bun dev
# or: npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. (Optional) Run with Docker

All Docker workflows are managed through `make`. Run `make help` from the project root to see all available targets.

```bash
make dev     # starts the live-reload dev container (source changes hot-reload)
make up      # builds and starts the production container
```

See the full Docker documentation in the [README](README.md#4-run-with-docker-compose).

---

## Contribution Workflow

All contributions are made via pull requests against the `main` branch.

### 1. Find or create an issue

Browse [open issues](https://github.com/codeforpdx/pdxhub/issues). Issues labeled `good first issue` are a great starting point for new contributors. If you have a new idea or found a bug, open an issue before starting work so the team can weigh in.

### 2. Create a branch

Branch from `main` using the naming convention `<issue-number>/<short-description>`:

```bash
git switch main
git pull origin main
git checkout -b "42/traffic-camera-modal"
```

> Example: `112/pwa-mobile-layout`, `7/fix-bridge-fetch-error`

You can also create a branch directly from the issue page on GitHub — click **"Create a branch"** under the **Development** section in the right-hand sidebar.

### 3. Make your changes

Work on your branch. Keep commits focused and use clear commit messages:

```bash
git add .
git commit -m "feat: add traffic camera overlay endpoint"
git push origin 42/traffic-camera-modal
```

### 4. Before opening a PR, check your work

The pre-commit hook runs automatically on every `git commit` and handles linting and formatting for you. If you want to run the checks manually:

```bash
bun run lint          # ESLint check
bun run lint:fix      # ESLint with auto-fix
bun run prettier:check  # Prettier format check
bun run prettier:run    # Prettier auto-format
```

There are no automated tests in the project yet — if you're adding a feature that is well-suited to testing, consider opening a follow-up issue or including tests if you're comfortable doing so.

### 5. Open a pull request

- Open a PR against the `main` branch on GitHub
- Use the pull request template — fill in all sections
- Add screenshots or screen recordings for any UI changes
- Request review from a project maintainer (see [reviewers](#reviewers) below)
- Make any changes requested by reviewers
- Once approved, merge the PR and delete your branch

---

## Coding Standards

PDX Hub uses **ESLint** for linting and **Prettier** for formatting. Both run automatically on staged files via a Husky pre-commit hook — you don't need to remember to run them manually.

```bash
bun run lint            # ESLint check
bun run lint:fix        # ESLint with auto-fix
bun run prettier:check  # check formatting
bun run prettier:run    # auto-format staged src files
```

For VS Code users, install the [ESLint extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) and [Prettier extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) for inline feedback while you code.

### Pre-commit hook

Husky runs `lint-staged` on every commit. It will automatically lint-fix and format any staged files in `src/` matching `*.{js,ts,tsx,jsx,css}`. If ESLint finds errors it cannot auto-fix, the commit will be blocked until you resolve them.

### TypeScript

- All new code should be fully typed. Avoid `any` — use `unknown` and narrow it.
- Shared types live in `src/types/index.ts`.
- New data sources should be normalized into `IncidentEvent` or `OverlayFeature` shapes before they touch the UI.

### Data sources

PDX Hub is a **middleware proxy** — it fetches, normalizes, and caches data from city sources. A few rules for new API integrations:

- Only integrate **documented, public APIs**. No HTML scraping.
- Respect each source's rate limits. Use Next.js ISR (`revalidate`) for GIS overlays and SWR polling intervals for incident feeds.
- Document the source URL and any required keys in `.env.example`.
- If a new key is required, add it to `.env.example` with a comment explaining where to get it.

### Project structure

```
src/app/api/          # Next.js API routes — one folder per data feed
src/lib/normalizers.ts  # All raw → IncidentEvent transformations
src/lib/arcgis.ts       # Reusable ArcGIS FeatureServer fetcher
src/components/         # React UI components
src/types/index.ts      # Shared TypeScript types
src/lib/constants.ts    # Map config, category filters, overlay configs
```

Adding a new GIS overlay? Follow the pattern established by any route in `src/app/api/overlays/` — it's a short, consistent pattern: fetch from ArcGIS, normalize to `OverlayFeature[]`, return as `OverlayApiResponse`.

---

## Submitting Bug Reports and Feature Requests

All issues are filed at [https://github.com/codeforpdx/pdxhub/issues](https://github.com/codeforpdx/pdxhub/issues).

### Bug Reports

Use the **Bug Report** template — it will auto-populate when you click "New Issue." Provide:
- A clear description of the bug and the error message
- Steps to reproduce
- Expected vs. actual behavior
- Your OS and browser

Template: [.github/ISSUE_TEMPLATE/bug_report.md](.github/ISSUE_TEMPLATE/bug_report.md)

### Feature Requests

Use the **Feature Request** template. Describe the problem it solves and your proposed solution.

Template: [.github/ISSUE_TEMPLATE/feature_request.md](.github/ISSUE_TEMPLATE/feature_request.md)

### Enhancement Requests

Use the **Enhancement Request** template for improvements to existing features.

Template: [.github/ISSUE_TEMPLATE/enhancement_request.md](.github/ISSUE_TEMPLATE/enhancement_request.md)

---

## Opening a Pull Request

If you are new to the team, a great first PR is a small documentation or README improvement — it helps you get familiar with the workflow before diving into code.

- All PRs should target `main`
- Fill out the [pull request template](.github/pull_request_template.md) completely
- Add screenshots or recordings for any visual/UI changes
- **Delete your branch after it is merged**

### Reviewers

Tag at least one maintainer for review on your PR: So either someone who has previously made a commit to the project or @Jared-Krajewski

> The reviewer list will grow as the contributor community does.

---

[Back to top ⬆️](#contributing-to-pdx-hub)
