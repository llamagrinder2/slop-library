# ToDo Page Functional Map

## Scope
This document describes how the ToDo page in index.html works, how items move into the library flow, and where to safely add features.

Current validated state:
- ToDo remains embedded in index.html (not separated into a standalone todo.html page)
- All current changes prioritize backward-compatible behavior with the original page flow

## Page Surface
Main ToDo UI is inside index.html page container with id todo.

Primary sections:
- Add button: toggles add form module
- Add form module id mod-addTodo
- Filter row with text filter id todoGenreFilter
- Filter row with duration bucket select id todoLengthFilter
- Card list mount id todoContainer
- Bulk list entry button to page id todo-list-view

## Entry and Navigation Behavior
Page switching is controlled by window.showPage in src/handlers/navigationHandlers.js.

When showPage("todo") runs:
- It clears active classes and activates ToDo page
- It resets the current todo filter via window.clearTodoGenreFilter when available
- It renders ToDo cards through window.renderTodo

Additional ToDo surface item:
- compact Spotify login button is available on ToDo page (intent: todo-login)

Deep links from URL are handled in src/main.js handleDeepLinkFromUrl.

Supported ToDo query params:
- page=todo: open ToDo page
- openAddTodo=1: auto-open add form module
- artist: prefill todoArtist input
- todoQuery: apply text filter through window.setTodoGenreFilter

After deep-link handling, URL params are removed with history.replaceState.

## Data Model (ToDo Item)
ToDo items are stored in todos array, then persisted with saveToFirebase.

Common fields:
- artist (required)
- album (required)
- coverUrl
- length
- year
- country
- genre
- recommender
- albumLink

## Create and Edit Flow
Implementation is in src/handlers/libraryCrudHandlers.js.

### Manual save: window.saveTodoOnly
- Validates artist and album are non-empty
- Builds todoData from form fields
- Country normalization:
  - 3-letter input forced uppercase
  - otherwise normalizeCountryCode
  - if empty, attempts inferred country from existing artist data
- Edit mode: updates existing item at todoEditIdx
- New mode: pushes to todos array
- Persists with saveToFirebase
- Clears form and closes add panel via toggleMod("addTodo")
- Re-renders ToDo cards

### Edit existing: window.editTodo
- Loads selected todo into form fields
- Sets todoEditIdx
- Opens add panel for editing

## Spotify Autofill Flow
Implementation: window.fetchSpotifyForTodo in src/handlers/libraryCrudHandlers.js.

Behavior:
- Requires spotifyToken; otherwise alerts user
- Expects Spotify album URL in todoSpotifyLink
- Extracts album id and calls Spotify album API
- Fills artist, album, year, cover, link, and computed total length
- Auto-fills country from existing artist data if still empty

## ToDo Card Rendering
Implementation: window.renderTodo in src/components/listAndTodo.js.

Filter behavior:
- Active filter comes from window.todoGenreFilter or input field
- Case-insensitive includes match over artist, album, genre, albumLink
- Optional duration-bucket filter runs in parallel with text search:
  - 0-10:00
  - 10:01-20:00
  - 20:01-30:00
  - 30:01-40:00
  - 40:01-50:00
  - 50:01-60:00
  - 60:00 felett

Duration parsing:
- supports mm:ss
- supports hh:mm:ss
- supports numeric minute value
- invalid or empty lengths are excluded from active duration buckets

Card behavior:
- Platform-style accent based on albumLink domain (spotify/youtube/bandcamp/generic)
- Link click sets latestTodo via window.setLatestTodo
- Action buttons:
  - check: moveToRating (transfer to library add form)
  - pencil: editTodo
  - delete: deleteAlbum(idx, "todo")

Empty state:
- Renders no-results message when filter has no matches

## Move To Rating (ToDo -> Library)
Implementation: window.moveToRating in src/handlers/libraryCrudHandlers.js.

Flow:
1. Read selected ToDo item
2. If albumLink is Spotify album link:
   - Requires spotifyToken
   - Fetch album tracks
   - Prompt user to choose favorite track
3. Prefill library add form fields (inArtist, inAlbum, inYear, etc.)
4. Reset rating-specific fields (score/review default empty, traits to Meh)
5. Remove item from todos array
6. Persist with saveToFirebase
7. Navigate to library page and open add module

This is the main conversion path from planning to rated library entry.

## Latest-ToDo Banner Integration
In src/main.js:
- window.setLatestTodo stores current highlighted todo and persists
- window.renderLatestTodoBanner shows a top banner in library page
- Banner quick action can call completeLatestTodo, which internally uses moveToRating

Spotify-aware banner behavior:
- completeLatestTodo checks Spotify session validity for Spotify-linked ToDo entries
- if token is missing/expired, it triggers auth flow with an intent and resumes after login
- post-auth resume uses pending action state and retries once if initial data hydration is late

## Write Paths Touching ToDo
- saveTodoOnly
- edit via saveTodoOnly with todoEditIdx
- moveToRating (removes from todos)
- deleteAlbum with todo type
- bulk table edits via updateTodoField in ToDo list view
- latestTodo changes also persisted in same root payload

All writes ultimately call saveToFirebase in src/main.js.

## Current Risk Areas
- Many ToDo actions are global window functions; naming collisions are possible
- moveToRating has Spotify branching and prompt UI, which is harder to test
- deleteAlbum triggers location.reload after save, which can hide granular state bugs
- Filter state resets every time user navigates back to ToDo via showPage("todo")

Stability hardening already applied:
- main bootstrap now guards initial initFilters/runFilter calls behind required DOM presence checks
- Spotify onTrackPicked callback now uses null-safe DOM access before writing inputs
- runFilter now exits early when library filter controls are missing (protects against accidental partial-render contexts)
- showPage now returns early when target page id is missing, avoiding unintended side-effects

## Safe Extension Points
Low-risk additions:
- Add extra client-side filter chips before renderTodo loop
- Add card badges derived from existing fields
- Add form validations before saveTodoOnly writes

Moderate-risk additions:
- Change moveToRating behavior or default trait initialization
- Change deep-link params for ToDo startup

High-risk additions:
- Change ToDo item schema without handling old items
- Replace delete/save mechanics without preserving saveToFirebase payload consistency
