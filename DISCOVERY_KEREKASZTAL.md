# Kerekasztal Page Functional Map

## Scope
This document describes kerekasztal.html: rating-table editing, autosave, session block tracking, top/divisiveness views, and debt (tartozasok) view.

## Page Type and Data Source
kerekasztal.html is a standalone page with an inline module script.

Data storage:
- Main rows document: data/kerekasztal in Firestore
- Session blocks collection: session_blocks in Firestore
- Artwork images uploaded to Storage path kerekasztal-art/*

## Main Views
The page has three switchable views controlled by nav buttons:
- ratingView: editable rating table (default)
- topView: top list + divisiveness list + slammer cards
- tartozasokView: member debt cards (missing ratings marked with !)

Function: setActiveView(viewName).

## Rating Table Model
Rows represent album picks with fields:
- date
- soros (picker member)
- band
- album
- artUrl (row artwork URL)
- ratings array for 10 members

Computed per row:
- avg-cell (average of numeric ratings)

Helpers:
- parseMemberScore: supports decimal parsing with comma replacement
- getAverageFromRatings

## Autosave and Editing Behavior
Autosave flow:
- setupAutosave binds input/change/click listeners on table body
- scheduleSave debounces writes (~450ms)
- saveRowsToFirebase writes serialized rows and updatedAt

Editing behavior:
- contenteditable cells for most fields
- soros column uses select dropdown
- row average recalculates on member input
- bang-alert highlighting when score cells contain !

Delete behavior:
- Row delete button asks two confirmations
- Removes row and saves
- Ensures at least one row remains

## Row Artwork Flow
Artwork can be drag-and-dropped onto band/album cells.

Flow:
1. Upload image to Storage (uploadRowArtwork)
2. Get URL via getDownloadURL
3. Apply overlays to band and album art cells (applyRowArtwork)
4. Persist row data with artUrl

Special text shortcut:
- Typing delete into album cell clears row artwork

## Session Tracker (Rounds)
Left sidebar tracks session blocks aligned to row ranges.

Data model per block:
- id
- label
- startRow
- endRow
- isSpecial
- order

Features:
- Add block (+ button)
- Editable labels
- Vertical resize handles for top/bottom boundaries
- Special edition detection when label equals special edition
- Deleting a block by typing delete in label

Sync behavior:
- Grid rows are aligned to table header + row heights
- Scroll sync between table and tracker
- ResizeObserver updates tracker layout on row height changes

Realtime behavior:
- subscribeSessionBlocksRealtime listens on session_blocks collection
- Local edits are debounced and batch-written with writeBatch

## Top and Divisiveness View
Function: renderTopList(rowsData).

Produces:
- Toplista by average rating
- Divisiveness ranking by custom formula
- Latest-date marker (star) on entries from newest date
- Row artwork overlays in toplists
- Picker hue tint on artist cells

Divisiveness formula implementation:
- Uses four components (N1, N2, N3, N4)
- Final index scaled by /31.5 * 100 with rounding

## Slammer Cards
Function: updateSlammerCards.

Displays two summary personas:
- Most picky (lowest average scorer)
- Easiest-to-impress (highest average scorer)

Also displays low/high score ranges and counts per member.

## Tartozasok View
Function: renderTartozasok.

Behavior:
- Builds one card per member (first 9 members; Kolos excluded)
- A row counts as debt for a member when that member rating contains !
- Card lists missing-rated albums with optional artwork thumbnail

## UI Interaction Helpers
- Sticky top nav hides on downward scroll and reveals on hover zone
- Divisiveness info popover supports click, hover, keyboard close
- Spellcheck/autocorrect disabled on editable controls

## Load and Boot Sequence
Startup sequence at bottom of script:
1. setupAutosave
2. initSessionTracker
3. disableNativeSpellcheck
4. bind view buttons and popovers
5. set default active view (rating)
6. sticky header setup
7. loadRowsFromFirebase
8. subscribeSessionBlocksRealtime

## Current Risk Areas
- Large inline script with many responsibilities in one file
- Tight coupling between DOM structure and script selectors
- Debounced writes plus realtime listeners can be tricky under concurrent edits
- Contenteditable and freeform symbols (like !) can create inconsistent data quality

## Safe Extension Points
Low-risk additions:
- Add validation hints for date/rating inputs
- Add quick filters in top/tartozasok views
- Add visual status badges per row without changing data schema

Moderate-risk additions:
- Extend divisiveness math or ranking rules
- Change session block semantics or default generation logic

High-risk additions:
- Migrate away from inline script without preserving window/global contracts
- Change Firestore document/collection schema without migration path
