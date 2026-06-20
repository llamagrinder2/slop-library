# Library Page (Konyvtar) Functional Map

## Scope
This document describes how the main library page in index.html works: filtering, rendering, add/edit flows, pagination, and save behavior.

## Page Surface
Main library page container id: library.

Core UI parts:
- Add module id mod-add (album creation/edit)
- Search/filter module id mod-search
- Latest ToDo banner id latest-todo-banner
- Render mount id listContainer
- Back-to-top button

## Entry and Navigation
window.showPage in src/handlers/navigationHandlers.js controls activation.

When showPage("library") runs:
- Calls initFilters to populate select options from albums
- Calls runFilter to render list cards

Deep links handled in src/main.js handleDeepLinkFromUrl:
- page=library
- libraryArtist -> maps to fArtist select
- libraryAlbum -> maps to gSearch input
- legacy libraryQuery supported

## Data Source and Persistence
Global state is loaded in loadFromFirebase in src/main.js.

Load strategy:
1. Local cache from localStorage (slopLibraryCacheV1) for instant paint
2. Firestore document data/library
3. Fallback public Storage mirror public/library.json
4. Last fallback local todo/settings keys

Persist strategy (saveToFirebase):
- Writes full payload to Firestore data/library
- Writes mirror JSON to Storage public/library.json
- Updates local cache slopLibraryCacheV1

## Filter System
Implementation: src/handlers/filterHandlers.js.

Inputs used by runFilter:
- gSearch
- fArtist
- fYear
- fGenre
- fCountry
- sortField

Search behavior:
- Matches artist, album, recommender name/key, exact numeric score, trait values
- Special terms:
  - hianyos or hiányos => incomplete entries only
  - nem hianyos or nem hiányos => complete entries only

Incomplete logic is based on missing review/favSong/cover/year/album/genre.

Sorting behavior:
- id, score use numeric compare
- other fields use case-insensitive text compare
- direction controlled by sortAsc toggled in navigation handlers

Pagination behavior:
- currentPage and itemsPerPage state
- renderPagination provides page controls and page size selector

## Library Card Rendering
Implementation: window.renderList in src/components/listAndTodo.js.

Card details include:
- row number (album id)
- cover art with optional external-link indicator
- artist name (click triggers qFilter by artist)
- country flag via getCountryFlag
- album title, length, year
- recommender tag and score badge
- optional review text
- traits pills (riff/vox/dob/mix/szoveg/vibe)
- favorite song link
- addedDate metadata

Card actions:
- Edit button -> editAlbum(index)
- Snapshot button -> captureCard
- Delete button -> deleteAlbum(index, "lib")
- Drag-and-drop image onto card -> handleDiskDrop updates coverUrl and hue

## Add/Edit Album Flow
Implementation: src/handlers/libraryCrudHandlers.js.

### saveAlbum
- Supports file upload to Storage album_covers/* and/or direct cover URL
- Normalizes/infers country
- Builds album object including traits and recommender
- Edit mode replaces existing album by editIdx
- New mode appends with next id
- Persists via saveToFirebase, then refreshes stats and list
- Resets form fields and traits defaults

### editAlbum
- Loads selected album into add form
- Sets editIdx and opens add module
- Prepopulates traits and metadata fields

### deleteAlbum for library items
- Confirms deletion
- Splices albums array
- Saves, then reloads page

## Related Library Integrations
- Latest ToDo banner is rendered above list and can complete a todo into library flow
- World map click can route into library with country filter
- Stats quick actions can open library and prefill filters
- Discography page deep links into this page using artist + album parameters

## Current Risk Areas
- Heavy use of window-level functions and inline onclick attributes
- deleteAlbum performs full reload, reducing fine-grained UX control
- Filter logic and card rendering are tightly coupled to global DOM ids
- Missing-field logic influences both visual state and search semantics

## Safe Extension Points
Low-risk additions:
- Add extra filter controls consumed in runFilter
- Add new card badges derived from existing fields
- Improve pagination UX without changing payload shape

Moderate-risk additions:
- Modify incomplete criteria (changes user-visible counts and searches)
- Change deep-link param behavior between stats/discography and library

High-risk additions:
- Modify save payload schema in saveToFirebase
- Change id generation strategy without migration handling
