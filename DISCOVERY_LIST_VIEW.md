# List View Functional Map

## Scope
This document describes the list view page (Excel-like table) behavior: rendering, inline editing, sorting, and row creation.

## Page Surface
List view page container id: listView in index.html.

Main elements:
- Add row button (+ BEJEGYZES) calling addNewListRow
- Table header with sortable columns
- Table body mount id excelBody

## Entry and Lifecycle
Navigation uses window.showPage in src/handlers/navigationHandlers.js.

When showPage("listView") runs:
- Calls renderExcelTable(getAlbums())
- No extra filtering is applied in this page itself

## Rendering Engine
Implementation: registerExcelTableHandlers in src/components/excelTable.js.

window.renderExcelTable(data):
- Rebuilds table body from provided album list
- Uses contenteditable cells for most scalar fields
- Uses select dropdowns for recommender and traits
- Re-initializes column resizers after each render

Trait columns:
- Stored under traits.riff, traits.vox, traits.dob, traits.mix, traits.szoveg, traits.vibe
- Ordering map TRAIT_ORDER is used for sorting these fields

## Inline Edit Behavior
### Text/number cells
- onfocus stores old value in dataset
- onblur calls handleCellEdit

handleCellEdit:
- Normalizes country values when field is country
- Compares old and new values
- If changed, calls updateAlbumField
- Briefly highlights edited cell

### Select controls
- onchange directly calls updateAlbumField

updateAlbumField:
- Finds album by id in albums array
- Supports nested traits updates
- Parses myScore as float
- Saves with saveToFirebase
- Calls runFilter to refresh library card view state

## Sorting Behavior
window.sortExcelTable(event, field, thElement):
- Ignores drag on column resizer handles
- Toggles asc/desc if same field clicked repeatedly
- Numeric sort for id/year/myScore
- Trait sort via TRAIT_ORDER map
- Text sort case-insensitive for other fields
- Adds sort-asc/sort-desc classes on active header
- Re-renders table after sorting in place

## Add New Row Flow
Implementation in src/main.js via window.addNewListRow and window.saveInlineNewRow.

Flow:
1. Inserts temporary row at top with editable inputs/selects
2. On focusout, if artist and album both empty -> remove row
3. Otherwise build new album object:
   - id = max existing id + 1
   - addedDate = today
   - traits defaults from select values
   - country normalized
4. Pushes to albums
5. Persists with saveToFirebase
6. Re-renders table and refreshes library filter view

## Data Coupling
List view edits write directly to the same albums array used by:
- library cards
- gallery
- stats
- map
- discography derivations

So list view acts as a bulk admin/editor surface for shared state.

## Current Risk Areas
- Direct contenteditable editing can introduce malformed values if validation is minimal
- Sorting mutates source albums array, affecting default order elsewhere
- Very frequent saveToFirebase calls during many edits can increase write volume

## Safe Extension Points
Low-risk additions:
- Add lightweight validation or formatting hints per column
- Add keyboard shortcuts for row navigation and save status UI
- Add optional debounce for repeated edits

Moderate-risk additions:
- Change sort semantics for text and traits
- Add new columns tied to new schema fields

High-risk additions:
- Replace id lookup strategy or shift to non-unique ids
- Decouple list data from albums without syncing all other views
