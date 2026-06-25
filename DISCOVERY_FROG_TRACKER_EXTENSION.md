# Discography + Frog Tracker Functional Map

## Scope
This document maps the relationship between `discography.html` and `frog-tracker.html`.

The two pages are separate views over the same shared album dataset:
- `albums`
- `todos`
- `artistTotals`

The discography page is the general artist completion browser. The frog tracker is a focused extension view for the single artist Phyllomedusa.

## Page Roles

### Discography page
`discography.html` is the artist-level completion matrix.

It answers:
- Which artists exist in the library and todo queues
- Which artists have missing albums relative to their known total
- Which artist rows contain library entries, todo entries, or missing slots

### Frog tracker page
`frog-tracker.html` is a specialized artist tracker for Phyllomedusa.

It answers:
- Which Phyllomedusa albums are already in the library
- Which Phyllomedusa albums are still in todo
- Which albums are missing entirely based on the saved total count

## Navigation Links

### Into discography
The app opens discography from the stats page through `window.openDiscographyPage` in `src/handlers/statsHandlers.js`.

### Between discography and frog tracker
In `discography.html`, the frog icon button `btnPhyllo` navigates to `./frog-tracker.html`.

### Back navigation from frog tracker
`frog-tracker.html` has two return buttons:
- `btnBackDiscog` returns to `./discography.html`
- `btnBackApp` returns to `./index.html`

## Shared Data Contract

Both pages load the same Firestore-backed dataset:
- primary source: `data/library` in Firestore
- fallback: `public/library.json` in Storage

Both pages read the same fields:
- `albums`
- `todos`
- `artistTotals`

Both pages use the same core ideas:
- normalize artist names by trimming
- dedupe albums with album title + year
- treat missing or invalid years as `99999`
- calculate missing slots from the saved total minus the known list length

## Discography Page Behavior

### Core grouping logic
The discography page builds one row per artist by merging three sources:
- library albums
- todo albums
- artist totals, so artists can appear even when they have no items yet

### Row state
Each artist row computes:
- `known`: merged and deduped album list
- `libCount`: number of library albums
- `todoCount`: number of todo albums
- `totalAlbumsCount`: stored expected total
- `missingCount`: number of missing slots
- `isIncomplete`: whether the row still needs work

### UI controls
Discography includes:
- artist search
- filters for all / zero / incomplete / complete
- sort by total albums or alpha order
- editable total albums input per artist
- save button per artist

### Click behavior
Row blocks do different things:
- library block: jumps back into the main app with `page=library`, `libraryArtist`, and `libraryAlbum`
- todo block: jumps back into the main app with `page=todo` and `todoQuery`
- missing block `?`: jumps into the todo add flow with the artist prefilled

### Write path
The only write from discography is saving a new total album count for an artist.

That save merges the updated `artistTotals` back into `data/library` while keeping `albums` and `todos` intact.

## Frog Tracker Page Behavior

### Scope
The frog tracker is a single-artist extension focused on `Phyllomedusa`.

It filters the shared dataset down to albums and todos whose artist matches Phyllomedusa.

### Row state
It computes one entry with:
- merged and deduped album list
- library count
- todo count
- total albums count
- missing count
- completion status

### UI controls
The frog tracker provides:
- refresh
- back to discography
- back to app
- a Bandcamp link shortcut
- a RYM shortcut

### Click behavior
Its blocks work like the discography blocks, but only for Phyllomedusa:
- library blocks jump into the main app library view
- todo blocks jump into the main app todo view
- missing blocks jump into the todo add form with Phyllomedusa prefilled

### Write path
Like discography, the frog tracker only writes one thing:
- the artist total count for Phyllomedusa

It writes that count back into `data/library` using a merge save.

## Functional Relationship

The frog tracker is effectively a scoped extension of the discography pattern:
- discography = all artists
- frog tracker = one artist

Important distinction:
- the newer release styling, card wrapping, gold complete-row treatment, legend updates, guide modal, and listened/known duration coverage belong to `discography.html`
- `frog-tracker.html` stays focused on the single Phyllomedusa board and does not inherit those discography-specific visuals

They share the same data model, merge logic, and deep-link style, but the frog tracker removes the need to search or browse across every artist.

## Safe Extension Points

### Discography
Low-risk additions:
- extra status filters
- per-row tooltips
- additional summary counters

Moderate-risk additions:
- changing dedupe rules
- changing the deep-link parameters into the main app

### Frog tracker
Low-risk additions:
- add more external shortcuts
- add extra summary metadata for Phyllomedusa
- style changes to the single-artist board

Moderate-risk additions:
- changing the merge/dedupe logic
- changing how the total count is persisted

## Current Risks
- Both pages still rely on inline scripts and direct DOM ids
- Both pages duplicate similar grouping logic instead of sharing a module
- A changed album dedupe rule would affect completion counts and missing slots
- A changed total-save payload could drift from the main app schema

## Suggested Refactor Path
1. Extract the shared grouping logic into a reusable module.
2. Keep discography as the multi-artist renderer.
3. Keep frog tracker as a one-artist renderer that reuses the shared helper.
4. Move deep-link helpers into a tiny shared URL utility.

This would keep the discography and frog tracker behavior aligned while making future changes easier to test.

## Current Status Note
- The app currently preserves the original integrated index navigation model (ToDo remains in index.html as an internal page)
- Stability improvements should be added conservatively so frog tracker behavior remains unchanged while shared deep-link contracts continue to work