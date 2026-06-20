# Settings Page (Beallitasok) Functional Map

## Scope
This document describes the Settings page inside index.html: genre categorization, slop toggles, utility tools, and data-write behavior.

## Entry and Navigation
Settings page is shown through window.showPage("settings") in src/handlers/navigationHandlers.js.

When showPage("settings") runs:
- It activates the settings page panel
- It calls window.renderSettings

## Page Surface
Settings panel id: settings in index.html.

Main cards/tools:
- Slop genre categorization list (setG)
- CSV import (handleCSV)
- Rainbow-grid color harvester (btnColorHarvester -> runColorHarvester)
- Country auto-match utility (btnCountryMatcher -> runCountryMatcher)
- Local data clear button (localStorage.clear + reload)

## Core Data Used
Settings logic is in src/handlers/settingsHandlers.js.

State arrays touched:
- slopG
- catDeath
- catBlack
- catCore
- catHeavy
- catEtc
- catNonMetal

Also reads:
- albums and todos

All persistent updates are written through saveToFirebase.

## Genre Categorization Renderer
Function: window.renderSettings.

Behavior:
- Collects all unique genres from albums (split by comma)
- Renders one row per genre into setG
- Each row has category assignment buttons:
  - DEATH, BLACK, CORE, HEAVY/Etc., ETC, NON-METAL
- Each row also has SLOP toggle button

Category buttons reflect active/inactive state via inline styles.

## Slop Toggle
Function: window.tSlop(genre).

Behavior:
- Adds/removes genre from slopG
- Calls saveToFirebase
- Re-renders settings

## Category Assignment
Function: window.tCat(genre, category).

Behavior:
- Removes genre from all category arrays first (single-category model)
- Adds genre to selected category array
- Calls saveToFirebase
- Re-renders settings

This ensures one genre belongs to one main category at a time.

## Color Harvester Utility
Function: window.runColorHarvester.

Goal:
- Compute dominantHue for album covers already stored in Firebase storage URLs.

Flow:
1. Filter albums with firebasestorage coverUrl and missing dominantHue
2. For each image:
   - load image with crossOrigin
   - sample full image pixels on canvas
   - compute average RGB and convert to hue
3. Write hue to album.dominantHue
4. Save once at the end (if any updates)

UI behavior:
- Button text shows progress and completion state
- Button disabled during processing

## Country Matcher Utility
Function: window.runCountryMatcher.

Goal:
- Fill missing country fields using existing known artist-country patterns.

Flow:
1. Build artist -> country frequency map from albums + todos
2. For each album/todo without country:
   - infer most frequent country for that artist
3. Save when there are updates
4. Refresh list/todo views if available

UI behavior:
- Button text shows in-progress and result counts
- Button disabled during run

## CSV Import Integration
Settings page exposes file input + import button, while parsing/import logic is in csv import feature module.

Expected CSV hint shown in UI:
- artist;album;year;genre;score;cover;review;favorite;link

## Write Paths Triggered From Settings
- tSlop
- tCat
- runColorHarvester
- runCountryMatcher
- CSV import path (through handleCSV and saveToFirebase in import flow)

All of these can mutate shared app data used by library/stats/discography views.

## Current Risk Areas
- renderSettings uses inline onclick-generated HTML, tightly coupled to window function names
- Category arrays are mutable globals; accidental misuse can affect stats grouping immediately
- Color harvester processes image pixels client-side and may be slow on large datasets
- Country matcher relies on inferred majority and may assign wrong country for ambiguous artists

## Safe Extension Points
Low-risk additions:
- Add preview counters (how many genres per category)
- Add filter/search box within setG for long genre lists
- Add dry-run mode for country matcher before save

Moderate-risk additions:
- Support multi-category assignment model (requires stats compatibility updates)
- Change slop/category semantics that stats currently depend on

High-risk additions:
- Alter save contract or array shapes consumed by stats and filters
- Replace generated settings row HTML without preserving action handlers
