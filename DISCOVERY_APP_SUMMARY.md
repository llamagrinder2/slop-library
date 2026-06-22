# Slop Library App Quick Summary

## What This App Is
A multi-view music tracking web app centered around one shared dataset:
- albums: rated library entries
- todos: planned listening queue
- artistTotals: optional expected discography totals per artist

Core UX goal:
- collect albums
- rate/review them
- manage what to listen to next
- see analytics and discography completion

## Main Pages
- Library (Konyvtar): card-based main browsing/filtering/rating surface
- Gallery: visual grid of covers
- Stats: charts, aggregates, quick drill-down actions
- Map: world map by country counts
- List View: spreadsheet-like admin editor for albums
- ToDo: queue management and conversion to library entries
- ToDo List View: bulk editable ToDo table
- Discography (separate file): artist completion matrix view
- Settings/Auth: category settings and sign-in controls

## Data Flow At A Glance
Read path:
1. local cache
2. Firestore data/library
3. public Storage mirror public/library.json
4. partial local fallbacks

Write path:
- saveToFirebase writes full payload to Firestore
- also writes public mirror JSON
- updates local cache

Most actions (add/edit/delete/filter-convert) mutate albums/todos arrays and call saveToFirebase.

## Architectural Pattern
- index.html contains most page markup and inline event attributes
- src/main.js is the bootstrap hub and global state owner
- feature/component/handler modules register window-level functions
- navigation is page-class toggling inside one SPA-style HTML document
- discography.html is a second page with its own inline module script

## Important Cross-Page Contracts
- Deep links from discography to index use URL params handled in src/main.js
- Stats page opens discography via openDiscographyPage
- ToDo conversion to library uses moveToRating and prefilled add form

## Navigation Notes
- The desktop hidden nav on index.html now includes `discog. tracker` between To-Do and Statisztikák
- `KEREK` uses a red-accented button style in the desktop nav
- `BEÁLLÍTÁSOK` remains in the desktop nav after `LISTA NÉZET`

## Statistics Page Summary
The statistics page is a dashboard driven by window.renderStats in src/handlers/statsHandlers.js.

What it provides:
- KPI summary tiles for totals, averages, incomplete entries, total listening time, and completed discographies
- Interactive charts for genres, years, score distribution, slop ratio, cumulative timeline, and trait distribution
- Drill-down behavior from charts and lists directly into library or todo filters
- Alternate card views for artist-level and genre-level browsing with sorting controls
- Review digest modal built from album reviews
- Snapshot export to clipboard with png download fallback

Design characteristic:
- The page is highly interactive and feature-rich, but currently centered around a large single render function with many DOM id dependencies and window-level handlers.

## Settings Page Summary
The settings page is driven by window.renderSettings in src/handlers/settingsHandlers.js and acts as an admin utility hub.

What it provides:
- Genre categorization controls (Death, Black, Core, Heavy, ETC, Non-Metal) used by stats grouping
- Slop genre toggles used by the Slop-O-Meter logic
- CSV import entry surface
- Color harvester utility to compute dominant cover hues
- Country matcher utility to infer missing country values from existing artist data

Design characteristic:
- It directly mutates global category arrays and writes through saveToFirebase, so changes impact stats and filtering immediately.

## Kerekasztal Page Summary
kerekasztal.html is a standalone Firestore-backed collaborative rating table with its own inline module script.

What it provides:
- Editable row-based rating table with autosave
- Session block tracker synced in realtime via a dedicated Firestore collection
- Top and divisiveness ranking view with artwork overlays
- Tartozasok view for missing ratings marked by !
- Drag-and-drop artwork upload to Firebase Storage

Design characteristic:
- Rich and custom UX in one file; very capable but strongly coupled to the page DOM and inline script architecture.

## Strengths
- Fast feature iteration using shared in-memory arrays
- Rich UI surface for both casual and admin-like usage
- Multiple complementary views over same underlying data
- Public JSON mirror enables read access fallback

## Main Technical Risks
- Many global window functions increase coupling
- Inline handlers and DOM-id dependencies make refactors fragile
- Full-payload saves can overwrite unexpected fields if schema evolves
- Reload-based delete flow hides state transitions

## Suggested Evolution Path
1. Move inline page logic into dedicated modules per page
2. Introduce a small central data service for read/write contracts
3. Add schema versioning or migration helpers
4. Add testable pure functions for filters, grouping, and completeness logic
5. Reduce hard reload usage after CRUD operations

## Existing Discovery Docs
- DISCOVERY_DISCOGRAPHY.md
- DISCOVERY_TODO.md
- DISCOVERY_LIBRARY_PAGE.md
- DISCOVERY_LIST_VIEW.md
- DISCOVERY_STATS_PAGE.md
- DISCOVERY_SETTINGS_PAGE.md
- DISCOVERY_KEREKASZTAL.md
- DISCOVERY_APP_SUMMARY.md
