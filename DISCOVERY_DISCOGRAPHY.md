# Discography Page Functional Map

## Scope
This document describes how discography.html works today, which data it depends on, and where to safely add features.

## Entry Point
- stats page card click calls window.openDiscographyPage in src/handlers/statsHandlers.js
- window.openDiscographyPage navigates to ./discography.html

## Data Loading Order in discography.html
1. Try Firestore document: collection data, doc library
2. If Firestore read fails or is empty, fallback to Storage file public/library.json
3. If both fail, show error banner and stop rendering

Loaded fields:
- albums: array
- todos: array
- artistTotals: object map from artist name to total album count

## Normalization Rules
- Artist key: String trim
- Album key for dedupe: lowercased album + year
- Year parsing: parseInt, invalid becomes 99999 (sorted to end)

## Grouping and Merge Logic
For each artist, rows are built from three sources:
- library albums
- todo albums
- artistTotals keys (artists with totals but no items still appear)

Deduping behavior:
- library has priority
- todo only inserted if same album-year key does not already exist

Per artist computed values:
- known: deduped ordered album list
- libCount: known albums from library source
- todoCount: known albums from todo source
- totalAlbumsCount: parsed from artistTotals, default 0
- missingCount: max(0, totalAlbumsCount - known.length), only if totalAlbumsCount > 0
- isIncomplete: true when totalAlbumsCount is 0, or todoCount > 0, or missingCount > 0
- knownDurationSeconds: sum of parseable lengths across known entries
- listenedDurationSeconds: sum of parseable lengths across known entries where source is library

## Rendering Rules
Each artist row contains:
- Artist header with status summary
- Editable totalAlbumsCount input + Save button
- Visual block strip of albums

Additional header controls:
- Info/guide icon next to page title opens a modal Discography Tracking Guide
- Guide modal is dark themed, vertically scrollable, and closable via close button, overlay click, or Escape

Current display updates:
- Row title now uses "releases" instead of "albums"
- Complete rows get a gold-tinted highlight and gold border treatment
- Album blocks wrap onto additional lines when needed so crowded rows grow downward instead of staying a single horizontal strip
- Release tags are read from the album title suffix and affect only library blocks:
   - `(EP)` uses a dashed border
   - `(demo)` uses a reddish-orange border
   - `(split)` uses a diagonal split overlay
   - LP entries without a bracket tag remain unchanged
- Artist row also shows duration coverage in listened / known format using only parseable length values

Block types:
- library block: clickable, jumps to index library page with artist + album deep link
- todo block: clickable, jumps to index todo page with todoQuery
- missing block with ?: clickable, jumps to index todo page and opens add-todo module prefilled with artist

Legend updates:
- `LP` replaces the old library legend label
- Additional legend entries exist for EP, demo, and split styling

Meta line summary at top:
- total artists
- completed artists
- incomplete artists
- artists with missing slots

Search behavior:
- local filter by artist name only
- does not filter by album title

Sort behavior:
- Sort total (asc/desc)
- Sort alpha (A-Z / Z-A)
- Sort time by known duration coverage (asc/desc)

## Cross-Page Deep Links Consumed by index page
Handled in src/main.js handleDeepLinkFromUrl:

Library mode:
- page=library
- libraryArtist (mapped to fArtist select)
- libraryAlbum (mapped to gSearch text)
- fallback old param: libraryQuery

Todo mode:
- page=todo
- openAddTodo=1 opens add todo panel
- artist prefills todoArtist
- todoQuery forwards to window.setTodoGenreFilter

URL cleanup:
- after handling, URL query params are removed with history.replaceState

## Write Paths
Only one write from discography page:
- saveArtistTotal writes artistTotals to Firestore data/library via setDoc merge
- payload includes albums and todos unchanged plus updated artistTotals

## Current Risk Areas
- Large inline script in discography.html makes feature additions harder to test
- saveArtistTotal writes full payload shape; if schema grows, this path may drift
- Album dedupe key is album + year only, so same-name albums with same year collapse
- Search only by artist can feel limited for larger libraries

## Safe Extension Points
Low-risk additions:
- Add new UI controls in discography.html and apply filters before render
- Add computed counters in render without touching backend
- Add block tooltip metadata from known fields

Moderate-risk additions:
- Change dedupe identity rules (can change counts and completion status)
- Change deep link query behavior (must keep src/main.js in sync)

High-risk additions:
- Change data source contract for albums/todos/artistTotals
- Move write logic without preserving merge semantics

## Suggested Future Refactor (for easier editing)
1. Move inline script from discography.html to src/pages/discographyPage.js
2. Split into pure functions:
   - loadDiscographyData
   - buildDiscographyGroups
   - renderDiscographyRows
   - wireDiscographyEvents
3. Add tiny URL helper for deep link construction
4. Add one unit-testable module for grouping and missing-count logic

This keeps UI updates separate from data logic and reduces regression risk when adding features.
