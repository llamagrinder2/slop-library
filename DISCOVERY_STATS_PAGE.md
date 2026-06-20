# Statistics Page Functional Map

## Scope
This document describes how the statistics page works in index.html, including summary counters, charts, drill-down actions, alternate views, and snapshot export.

## Entry and Navigation
Main entry point is window.showPage("stats") in src/handlers/navigationHandlers.js.

When showPage("stats") runs:
- It activates the stats page panel
- It calls window.renderStats

Stats page can also be reached through quick actions from other views.

## Primary UI Structure
Stats page root:
- index.html page container id stats

Main layouts inside stats:
- stats-grid: default dashboard view
- artists-view: alternate artists cards view
- genres-view: alternate genres cards view

Modal:
- reviewDigestModal
- reviewDigestContent

## Core Render Pipeline
Implementation is in src/handlers/statsHandlers.js, function window.renderStats.

Data sources used:
- albums from getAlbums
- todos from getTodos
- artistTotals from getArtistTotals
- category lists: catDeath/catBlack/catCore/catHeavy/catEtc/catNonMetal
- slop genres from getSlopGenres
- recommenders map from constants

If albums is empty, renderStats returns early.

## Summary KPI Tiles
The summary row updates these ids:
- stat-total-albums
- stat-total-artists
- stat-complete-discogs
- stat-total-genres
- stat-avg-score
- stat-total-yap
- stat-total-length
- stat-incomplete

Tile interactions:
- total albums: navigateToGalleryByDateAdded (opens library sorted newest first)
- total artists: navigateToArtistsView
- complete discogs: openDiscographyPage (opens discography.html)
- total genres: navigateToGenresView
- total yap: openReviewDigest modal

## Discography Completion Logic in Stats
Completed discogs value is derived from:
- lib count per artist from albums
- todo count per artist from todos
- expected totals from artistTotals

Artist is counted complete when:
- totalAlbumsCount > 0
- lib count equals totalAlbumsCount
- todo count is 0
- missing count is 0

This mirrors discography page semantics.

## Charts and Interactive Panels
### Genre pie chart (cGenre)
- Main mode: grouped by macro categories (Death/Black/Core/Heavy/ETC/Non-Metal/Besorolatlan)
- Sub mode: clicking a macro category drills into concrete genres for that category
- Clicking a sub-genre triggers library genre filter via qFilter("g", value)
- Clicking empty space in sub mode returns to main mode

### Year distribution chart (cYear)
- Bar chart of album count by year field
- Clicking a bar filters library by year via qFilter("y", year)

### Slop meter chart (cSlop)
- Stacked bar showing percent of albums tagged with configured slop genres

### Score distribution chart (cScoreDist)
- Buckets by 0.5 from 1.0 to 10.0
- Clicking a bucket routes to library score filter via filterByScore

### Timeline chart (chartTimeline)
- Weekly cumulative additions from addedDate
- Baseline includes legacy items without valid dates or before CURRENT_YEAR
- Year toggles rendered in timelineYearControls
- View switch handled by switchTimelineView and renderTimeline

### Traits stacked chart (chartTraits)
- Horizontal stacked distribution across RIFF/VOX/DOB/MIX/SZOVEG/VIBE
- Uses ratings: Peak, Igen, Meh, Nem, Poop, Volt??
- Values shown as percentages of total albums

## Ranking and List Panels
### Top/Bottom lists
- topG: genre averages (min sample threshold from median genre frequency)
- topY: year averages (min sample threshold from median year frequency)
- toggleTopSort flips top vs bottom behavior

### Countries panel
- listCountries card grid with count, percent, average score
- sortCountriesBy supports count/rating sorting and toggles asc/desc
- Clicking a country card filters library by country via qFilter("c", code)

### Rare genres panel
- listRare shows genres below median frequency threshold
- btnRareTodoAdjust toggles adjusted view that includes ToDo genre counts
- Adjusted state can highlight genres likely to stop being rare

### ToDo genres panel
- listTodoGenres shows ToDo genre frequency
- Clicking a genre opens ToDo page and applies todo text filter

### Recommender panel
- listRecStats shows count and average score per recommender key
- sortRecStats sorts by count or avg
- Clicking a recommender row jumps to library search scoped by recommender id

## Alternate Stats Subviews
### Artists view
Functions:
- navigateToArtistsView
- renderArtistsView
- sortArtistsBy
- handleArtistClick

Behavior:
- Builds artist cards with album count and average score
- Sorts by name/count/rating
- Clicking card filters library by artist via qFilter("a", name)

### Genres view
Functions:
- navigateToGenresView
- renderGenresView
- sortGenresBy
- handleGenreClick

Behavior:
- Builds genre cards with count and average score
- Sorts by name/count/rating
- Clicking card filters library by genre via qFilter("g", name)

### Return to default dashboard
- backToMainStats restores stats-grid and hides artists/genres subviews

## Review Digest Modal
Functions:
- openReviewDigest
- closeReviewDigest
- handleReviewDigestOverlayClick

Digest generation:
- Uses albums with non-empty reviews
- Sorted by addedDate timestamp fallback to id
- Escapes output for safety
- Escape key closes modal

## Snapshot Export
Function: captureStats(event)

Behavior:
- Uses html2canvas to capture stats panel
- Tries Clipboard API first
- Falls back to png download when clipboard write fails
- Updates snapshotMsg status text

## Dependencies and Coupling
- Requires Chart.js and ChartDataLabels globally available
- Depends heavily on fixed DOM ids in index.html
- Uses many window-global handlers, including qFilter, showPage, initFilters, runFilter

## Current Risk Areas
- Large monolithic renderStats mixes data prep, DOM writes, and chart creation
- Many nested closures and mutable globals increase regression risk
- Chart ids and panel ids are strict contracts; markup drift can silently break features
- CURRENT_YEAR is hard-coded in timeline logic

## Safe Extension Points
Low-risk additions:
- Add new summary counters from already-derived aggregates
- Add secondary sort options to existing panels
- Add tooltips and explanatory legends to chart containers

Moderate-risk additions:
- Change median thresholds or ranking formulas (will alter top/rare outputs)
- Change timeline baseline rules and yearly reset semantics

High-risk additions:
- Split renderStats behavior without preserving window function contracts
- Change id names or remove panels used by handler lookups
