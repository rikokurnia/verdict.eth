# Dashboard alignment

The landing page is the visual source of truth, per the user's corrected direction.

## Changes

- Scoped `app/(app)/landing-theme.css` applies Archivo / Archivo Narrow, navy, ice blue, cool surfaces, fine borders and square-edged controls to all dashboard routes.
- Shared the actual landing-page Verdict SVG mark with the dashboard shell. Added a link back to the landing page.
- Kept existing dashboard content, routes, tables, scenario logic and semantic policy colors.
- Repaired the skip-link's inline positioning and narrow-screen sizing.
- Fixed the existing Next.js async route-parameter warning in asset detail with React `use(params)`. Previously the synchronous read could fall back to the first demo asset.

## Verification, 2026-09-08

- `npm run build`: passed, including TypeScript and all app routes.
- `npm test`: passed.
- gstack browser screenshots inspected at 1440×900, 768×1024 and 375×812.
- Mobile dashboard and asset detail: document width equals 375px; wide tables/graphs remain locally scrollable.
- Dashboard search: nonmatching query shows the existing empty state.
- Mobile menu opens; Escape dismisses it.
- USD Yield 002 resolves its own title and REVIEW state. Resolver-offline scenario returns UNAVAILABLE.
- Reduced-motion CSS retains the existing transition/animation opt-out; no ambient dashboard animation added.

Screenshots from this pass are `/tmp/verdict-dashboard-desktop.png`, `/tmp/verdict-dashboard-tablet.png`, `/tmp/verdict-dashboard-mobile.png` and `/tmp/verdict-detail-mobile.png` (detail capture precedes the route-param fix).

Scope limits: this is a visual alignment, not live ENS integration. Existing topbar search is still a presentational input; the in-page dashboard filter is functional. No physical phone testing or full backend QA was performed. React Bits landing-page effects remain separate work; this pass did not add them or alter scroll-craft.
