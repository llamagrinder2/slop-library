import { db, auth, storage, provider, doc, getDoc, setDoc, onSnapshot, signInWithPopup, onAuthStateChanged, signOut, ref, uploadBytes, getDownloadURL } from "./core/firebase.js";
import { TRAIT_VALUES, TRAIT_ORDER, recommenders } from "./core/constants.js";
import { COUNTRY_ALPHA3_TO_ALPHA2, USA_STATE_CODE_TO_NAME, normalizeCountryCode, parseCountryCodeParts } from "./core/countries.js";
import { state } from "./state/appState.js";
import { initSpotifyService } from "./features/spotifyService.js";
import { registerCsvImport } from "./features/csvImportService.js";
import { initMobileHeaderAutoHide, registerHueExtraction } from "./features/imageProcessing.js";
import { getRecommenderHTML } from "./components/recommenderTag.js";
import { registerGalleryComponents } from "./components/gallery.js";
import { registerListAndTodoComponents } from "./components/listAndTodo.js";
import { registerNavigationHandlers } from "./handlers/navigationHandlers.js";
import { registerFilterHandlers } from "./handlers/filterHandlers.js";
import { registerLibraryCrudHandlers } from "./handlers/libraryCrudHandlers.js";
import { registerSettingsHandlers } from "./handlers/settingsHandlers.js";
import { registerAuthHandlers } from "./handlers/authHandlers.js";
import { registerStatsHandlers } from "./handlers/statsHandlers.js";
import { registerExcelTableHandlers } from "./components/excelTable.js";

Chart.defaults.devicePixelRatio = 3;
Chart.register(ChartDataLabels);

let currentUser = null;
let spotifyToken = null;

let isRainbowMode = state.isRainbowMode;
let sortAsc = state.sortAsc;
let albums = state.albums;
let todos = state.todos;
let artistTotals = state.artistTotals || {};
let latestTodo = null;
let todoEditIdx = state.todoEditIdx;
let slopG = state.slopG;
let charts = state.charts;
let editIdx = state.editIdx;
let currentPage = state.currentPage;
let itemsPerPage = state.itemsPerPage;
let topSortAsc = state.topSortAsc;
let catDeath = state.catDeath;
let catBlack = state.catBlack;
let catCore = state.catCore;
let catHeavy = state.catHeavy;
let catEtc = state.catEtc;
let catNonMetal = state.catNonMetal;
let currentGenreLevel = state.currentGenreLevel;
let isGalleryDetailsMode = false;
const LIBRARY_CACHE_KEY = "slopLibraryCacheV1";
const SPOTIFY_PENDING_ACTION_KEY = "spotify_pending_action";
const LIBRARY_CHUNK_ROOT_ID = "library";
const MAX_ITEMS_PER_CHUNK = 500;
let libraryRealtimeUnsub = null;
let latestLibraryChunkId = LIBRARY_CHUNK_ROOT_ID;
let loadedLibraryChunkIds = [LIBRARY_CHUNK_ROOT_ID];

const isMissing = (val) => {
    if (!val) return true;
    const s = String(val).trim();
    return s === "" || s === "0" || s === "?" || s === "https://via.placeholder.com/120";
};

function normalizeTodoItem(todo) {
    return {
        ...(todo || {}),
        isPrioritized: Boolean(todo && todo.isPrioritized)
    };
}

function requiresSpotifyForTodo(todoItem) {
    const link = String(todoItem?.albumLink || "");
    return /open\.spotify\.com\/album\/[a-zA-Z0-9]+/i.test(link);
}

function getPendingSpotifyAction() {
    try {
        const raw = window.localStorage.getItem(SPOTIFY_PENDING_ACTION_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function setPendingSpotifyAction(action) {
    try {
        window.localStorage.setItem(SPOTIFY_PENDING_ACTION_KEY, JSON.stringify(action));
    } catch (err) {
        console.warn("Pending Spotify action save failed:", err);
    }
}

function clearPendingSpotifyAction() {
    try {
        window.localStorage.removeItem(SPOTIFY_PENDING_ACTION_KEY);
    } catch (err) {
        console.warn("Pending Spotify action clear failed:", err);
    }
}

window.openMobileMenu = function() {
    document.body.classList.add("mobile-menu-open");
};

window.normalizeCountryInput = function(inputEl) {
    if (!inputEl || !inputEl.value.trim()) return;
    const raw = inputEl.value.trim();
    if (/^[A-Za-z]{3}$/.test(raw)) {
        inputEl.value = raw.toUpperCase();
    } else {
        const normalized = normalizeCountryCode(raw);
        if (normalized) inputEl.value = normalized;
    }
};

window.normalizeCountryCell = function(cell) {
    if (!cell || !cell.innerText.trim()) return;
    const raw = cell.innerText.trim();
    if (/^[A-Za-z]{3}$/.test(raw)) {
        cell.innerText = raw.toUpperCase();
    } else {
        const normalized = normalizeCountryCode(raw);
        if (normalized) cell.innerText = normalized;
    }
};

window.closeMobileMenu = function() {
    document.body.classList.remove("mobile-menu-open");
};

window.toggleMobileMenu = function() {
    document.body.classList.toggle("mobile-menu-open");
};

window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") window.closeMobileMenu();
});

window.addNewListRow = function() {
    if (document.querySelector(".new-entry-row")) {
        document.querySelector(".new-entry-row .new-val-artist").focus();
        return;
    }

    const body = document.getElementById("excelBody");
    const tr = document.createElement("tr");
    tr.className = "new-entry-row";

    const makeTraitSelect = (field) => `
        <select class="inline-edit new-val-${field}">
            ${TRAIT_VALUES.map((opt, idx) => `<option value="${opt}" ${idx === 3 ? "selected" : ""}>${opt}</option>`).join("")}
        </select>
    `;

    tr.innerHTML = `
        <td style="color:var(--accent); font-weight:bold;">UJ</td>
        <td contenteditable="true" class="new-val-artist" placeholder="Eloado..." style="background:#222;"></td>
        <td contenteditable="true" class="new-val-album" placeholder="Album..." style="background:#222;"></td>
        <td contenteditable="true" class="new-val-year" placeholder="Ev" style="background:#222;"></td>
        <td contenteditable="true" class="new-val-country" placeholder="Orsz." style="background:#222;" onblur="window.normalizeCountryCell(this)"></td>
            <td contenteditable="true" class="new-val-length" placeholder="Hossz (mm:ss)" style="background:#222;"></td>
        <td contenteditable="true" class="new-val-genre" placeholder="Mufaj" style="background:#222;"></td>
        <td><select class="inline-edit new-val-rec">${buildRecommenderOptions()}</select></td>
        <td contenteditable="true" class="new-val-score" placeholder="Pont" style="background:#222;"></td>
        <td contenteditable="true" class="new-val-review" placeholder="Komment..." style="background:#222;"></td>
        <td>${makeTraitSelect("riff")}</td>
        <td>${makeTraitSelect("vox")}</td>
        <td>${makeTraitSelect("dob")}</td>
        <td>${makeTraitSelect("mix")}</td>
        <td>${makeTraitSelect("szoveg")}</td>
        <td>${makeTraitSelect("vibe")}</td>
        <td contenteditable="true" class="new-val-favSong" placeholder="Kiemelt dal..." style="background:#222;"></td>
        <td contenteditable="true" class="new-val-songUrl" placeholder="Link..." style="background:#222;"></td>
        <td contenteditable="true" class="new-val-coverUrl" placeholder="Borito URL..." style="background:#222;"></td>
    `;

    body.insertBefore(tr, body.firstChild);
    tr.querySelector(".new-val-artist").focus();

    tr.addEventListener("focusout", function() {
        setTimeout(async () => {
            if (!tr.contains(document.activeElement)) {
                const artist = tr.querySelector(".new-val-artist").innerText.trim();
                const album = tr.querySelector(".new-val-album").innerText.trim();

                if (!artist && !album) tr.remove();
                else await window.saveInlineNewRow(tr);
            }
        }, 50);
    });
};

window.saveInlineNewRow = async function(tr) {
    tr.style.opacity = "0.5";

    const maxId = albums.length > 0 ? Math.max(...albums.map((a) => a.id || 0)) : 0;
    const newId = maxId + 1;

    const val = (cls) => {
        const el = tr.querySelector(".new-val-" + cls);
        return el ? (el.tagName === "SELECT" ? el.value : el.innerText.trim()) : "";
    };

    const dateInput = new Date().toISOString().split("T")[0];

    const newAlbum = {
        id: newId,
        artist: val("artist"),
        album: val("album"),
        year: val("year") ? Number(val("year")) : "",
        country: (() => {
            const raw = val("country");
            if (!raw) return "";
            if (/^[A-Za-z]{3}$/.test(raw)) return raw.toUpperCase();
            return normalizeCountryCode(raw);
        })(),
        genre: val("genre"),
        recommender: val("rec"),
        myScore: parseFloat(val("score")) || 0,
        review: val("review"),
        traits: {
            riff: val("riff"),
            vox: val("vox"),
            dob: val("dob"),
            mix: val("mix"),
            szoveg: val("szoveg"),
            vibe: val("vibe")
        },
        favSong: val("favSong"),
        songUrl: val("songUrl"),
        coverUrl: val("coverUrl"),
        addedDate: dateInput
            ,
        length: val("length")
    };

    albums.push(newAlbum);
    await saveToFirebase();
    window.renderExcelTable(albums);
    window.runFilter();
};

function buildRecommenderOptions(selectedKey = "") {
    const baseOption = '<option value="">-- Sajat --</option>';
    const otherOptions = Object.entries(recommenders)
        .map(([key, data]) => `<option value="${key}"${key === selectedKey ? " selected" : ""}>${data.name1}</option>`)
        .join("");
    return baseOption + otherOptions;
}

(function() {
    const recEntries = Object.entries(recommenders);
    ["inRec", "todoRec"].forEach((id) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = "";

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "-- Sajat felfedezes --";
        sel.appendChild(placeholder);

        recEntries.forEach(([key, data]) => {
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = data.name1;
            sel.appendChild(opt);
        });
    });
})();

window.getRecommenderHTML = function(recKey) {
    return getRecommenderHTML(recommenders, recKey);
};

async function renderWorldMap() {
    const container = document.getElementById("world-map-container");
    if (!container) return;
    container.innerHTML = "";

    const alpha2ToAlpha3 = Object.fromEntries(
        Object.entries(COUNTRY_ALPHA3_TO_ALPHA2).map(([alpha3, alpha2]) => [String(alpha2 || "").toUpperCase(), alpha3])
    );

    const stripAccents = (value) =>
        String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();

    const resolveCountryCode = (feature) => {
        const properties = feature && feature.properties ? feature.properties : {};
        const rawCodes = [
            properties.iso_a3,
            properties.ISO_A3,
            properties.ISO3,
            properties.iso_a2,
            properties.ISO_A2,
            feature && feature.id
        ]
            .map((value) => String(value || "").trim())
            .filter(Boolean);

        for (const raw of rawCodes) {
            const upper = raw.toUpperCase();
            if (countryCounts[upper]) return upper;
            if (alpha2ToAlpha3[upper] && countryCounts[alpha2ToAlpha3[upper]]) return alpha2ToAlpha3[upper];
        }

        const name = stripAccents(properties.name || properties.NAME || properties.admin || "");
        const normalizedNameCode = normalizeCountryCode(name);
        if (normalizedNameCode && countryCounts[normalizedNameCode]) return normalizedNameCode;

        return normalizedNameCode || rawCodes[0]?.toUpperCase() || "";
    };

    const countryCounts = {};
    const usStateCounts = {};

    (albums || []).forEach((album) => {
        const raw = album && album.country ? String(album.country).trim() : "";
        if (!raw) return;
        if (["UNDEFINED", "NULL", "?"].includes(raw.toUpperCase())) return;

        const parsed = parseCountryCodeParts(raw);
        if (parsed.countryCode === "USA" && parsed.regionCode) {
            usStateCounts[parsed.regionCode] = (usStateCounts[parsed.regionCode] || 0) + 1;
            return;
        }
        if (parsed.countryCode === "USA" && !parsed.regionCode) {
            // Plain USA records are intentionally excluded from heatmap counts.
            return;
        }

        const normalized = parsed.canonical || normalizeCountryCode(raw) || raw.toUpperCase();
        countryCounts[normalized] = (countryCounts[normalized] || 0) + 1;
    });

    // Basic SVG setup
    const width = Math.max(600, container.clientWidth || 800);
    const height = Math.max(300, container.clientHeight || 400);
    const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);
    svg.style("user-select", "none").style("touch-action", "none").style("cursor", "grab");

    svg.on("contextmenu", (event) => event.preventDefault());

    // Projection and path
    const projection = d3.geoNaturalEarth1();
    const path = d3.geoPath().projection(projection);

    const zoomLayer = svg.append("g").attr("class", "worldmap-zoom-layer");
    const mapGroup = zoomLayer.append("g").attr("class", "worldmap-map-group");

    const zoomBehavior = d3.zoom()
        .scaleExtent([1, 8])
        .filter((event) => {
            if (event.type === "wheel") return true;
            if (event.type === "mousedown") return event.button === 0;
            if (event.type === "touchstart") return true;
            return false;
        })
        .on("start", () => svg.style("cursor", "grabbing"))
        .on("end", () => svg.style("cursor", "grab"))
        .on("zoom", (event) => {
            zoomLayer.attr("transform", event.transform);
        });

    svg.call(zoomBehavior).on("dblclick.zoom", null);

    // Tooltip
    let tooltip = d3.select("body").select(".worldmap-tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div").attr("class", "worldmap-tooltip").style("position", "absolute").style("pointer-events", "none").style("background", "#222").style("color", "#fff").style("padding", "6px 8px").style("border-radius", "4px").style("opacity", 0).style("font-size", "12px");
    }

    // Color scale
    const maxCount = Math.max(0, ...Object.values(countryCounts), ...Object.values(usStateCounts));
    const color = d3.scaleSequential((t) => d3.interpolateRgb("#4a4a4a", "#ffcc00")(t)).domain([0, Math.max(1, maxCount)]);

    const US_STATE_FIPS_TO_CODE = {
        "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE",
        "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS",
        "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
        "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY",
        "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC",
        "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
        "55": "WI", "56": "WY"
    };

    // Load topojson and draw
    try {
        const world = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
        const countries = topojson.feature(world, world.objects.countries).features;
        projection.fitSize([width, height], { type: "FeatureCollection", features: countries });

        mapGroup.selectAll("path")
            .data(countries)
            .enter().append("path")
            .attr("d", path)
            .attr("fill", (d) => {
                const code = resolveCountryCode(d);
                const c = countryCounts[code] || 0;
                return c > 0 ? color(c) : "#2a2a2a";
            })
            .attr("stroke", "#111")
            .style("pointer-events", "all")
            .on("mousemove", (event, d) => {
                const code = resolveCountryCode(d);
                const count = countryCounts[code] || 0;
                const name = (d.properties && (d.properties.name || d.properties.NAME || d.properties.admin)) || code;
                tooltip.style("left", (event.pageX + 8) + "px").style("top", (event.pageY + 8) + "px").style("opacity", 1).html(`${name}: ${count} albums`);
            })
            .on("mouseout", () => tooltip.style("opacity", 0))
            .on("click", (event, d) => {
                const code = resolveCountryCode(d);
                if (countryCounts[code]) {
                    if (typeof showPage === 'function') showPage('library');
                    const el = document.getElementById('fCountry');
                    if (el) el.value = code;
                    if (typeof runFilter === 'function') runFilter();
                }
            });

        const usStatesTopo = await d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json");
        const usStateFeatures = topojson.feature(usStatesTopo, usStatesTopo.objects.states).features;

        mapGroup.append("g")
            .attr("class", "us-state-layer")
            .selectAll("path")
            .data(usStateFeatures)
            .enter()
            .append("path")
            .attr("d", path)
            .attr("fill", (d) => {
                const fips = String(d.id || "").padStart(2, "0");
                const stateCode = US_STATE_FIPS_TO_CODE[fips];
                const count = stateCode ? (usStateCounts[stateCode] || 0) : 0;
                return count > 0 ? color(count) : "rgba(42,42,42,0.01)";
            })
            .attr("stroke", "#1b1b1b")
            .attr("stroke-width", 0.8)
            .style("pointer-events", "all")
            .on("mousemove", (event, d) => {
                const fips = String(d.id || "").padStart(2, "0");
                const stateCode = US_STATE_FIPS_TO_CODE[fips];
                if (!stateCode) return;
                const stateName = USA_STATE_CODE_TO_NAME[stateCode] || stateCode;
                const count = usStateCounts[stateCode] || 0;
                tooltip
                    .style("left", (event.pageX + 8) + "px")
                    .style("top", (event.pageY + 8) + "px")
                    .style("opacity", 1)
                    .html(`USA, ${stateCode} (${stateName}): ${count} albums`);
            })
            .on("mouseout", () => tooltip.style("opacity", 0))
            .on("click", (event, d) => {
                const fips = String(d.id || "").padStart(2, "0");
                const stateCode = US_STATE_FIPS_TO_CODE[fips];
                if (!stateCode || !usStateCounts[stateCode]) return;

                if (typeof showPage === "function") showPage("library");
                const el = document.getElementById("fCountry");
                if (el) el.value = `USA, ${stateCode}`;
                if (typeof runFilter === "function") runFilter();
            });

        // Legend (simple)
        const legendWidth = 180;
        const legend = svg.append("g").attr("transform", `translate(${width - legendWidth - 12}, ${12})`);
        legend.append("rect").attr("width", legendWidth).attr("height", 36).attr("fill", "rgba(0,0,0,0.25)").attr("rx", 6);
        legend.append("text").attr("x", 8).attr("y", 14).attr("fill", "#ccc").attr("font-size", 12).text("Albums per country/state");
        legend.append("text").attr("x", 8).attr("y", 30).attr("fill", "#ccc").attr("font-size", 11).text(`Max: ${maxCount}`);

        // If no data, show message
        if (Object.keys(countryCounts).length === 0) {
            svg.append("text").attr("x", width / 2).attr("y", height / 2).attr("text-anchor", "middle").attr("fill", "#888").text("No map data available");
        }

    } catch (err) {
        console.error("World map drawing failed:", err);
        svg.append("text").attr("x", width / 2).attr("y", height / 2).attr("text-anchor", "middle").attr("fill", "#f88").text("Map load error");
    }

}

window.renderWorldMap = renderWorldMap;

setTimeout(() => {
    const filterIds = ["gSearch", "fArtist", "fYear", "fGenre", "sortField"];
    filterIds.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const eventType = id === "gSearch" ? "input" : "change";
        el.addEventListener(eventType, () => {
            currentPage = 1;
            state.currentPage = 1;
            if (typeof window.runFilter === "function") window.runFilter();
        });
    });
}, 500);

function sortLibraryChunkIds(chunkIds = []) {
    return Array.from(new Set((chunkIds || []).filter(Boolean))).sort((a, b) => {
        if (a === LIBRARY_CHUNK_ROOT_ID) return -1;
        if (b === LIBRARY_CHUNK_ROOT_ID) return 1;
        const aMatch = String(a).match(/^library_(\d+)$/);
        const bMatch = String(b).match(/^library_(\d+)$/);
        if (aMatch && bMatch) return Number(aMatch[1]) - Number(bMatch[1]);
        return String(a).localeCompare(String(b));
    });
}

function getNextLibraryChunkId(baseChunkId = latestLibraryChunkId) {
    if (baseChunkId === LIBRARY_CHUNK_ROOT_ID) return "library_2";
    const match = String(baseChunkId).match(/^library_(\d+)$/);
    if (match) return `library_${Number(match[1]) + 1}`;
    return "library_2";
}

function resolveChunkTarget(explicitChunkId, fallbackChunkId, chunkBuckets) {
    const requestedChunkId = explicitChunkId && String(explicitChunkId).trim()
        ? String(explicitChunkId).trim()
        : fallbackChunkId;

    let candidateChunkId = requestedChunkId;
    let attempts = 0;
    while (attempts < 20) {
        const bucket = chunkBuckets.get(candidateChunkId);
        if (!bucket || bucket.length < MAX_ITEMS_PER_CHUNK) return candidateChunkId;
        candidateChunkId = getNextLibraryChunkId(candidateChunkId);
        attempts += 1;
    }
    return candidateChunkId;
}

function buildChunkedLibraryPayload(payload) {
    const items = Array.isArray(payload.albums) ? payload.albums : [];
    const chunkBuckets = new Map();
    const ensureChunk = (chunkId) => {
        if (!chunkBuckets.has(chunkId)) chunkBuckets.set(chunkId, []);
        return chunkBuckets.get(chunkId);
    };

    let currentChunkId = latestLibraryChunkId || LIBRARY_CHUNK_ROOT_ID;
    items.forEach((item) => {
        if (!item || typeof item !== "object") return;

        const targetChunkId = resolveChunkTarget(item._chunkId, currentChunkId, chunkBuckets);
        const targetBucket = ensureChunk(targetChunkId);
        targetBucket.push(item);
        item._chunkId = targetChunkId;
        currentChunkId = targetChunkId;
    });

    const orderedChunkIds = sortLibraryChunkIds([LIBRARY_CHUNK_ROOT_ID, ...Array.from(chunkBuckets.keys()).filter((chunkId) => chunkId !== LIBRARY_CHUNK_ROOT_ID)]);
    const chunkPayloads = orderedChunkIds.map((chunkId) => {
        const chunkItems = (chunkBuckets.get(chunkId) || []).map((item) => {
            const sanitized = { ...item };
            delete sanitized._chunkId;
            return sanitized;
        });
        return {
            chunkId,
            data: {
                albums: chunkItems,
                updatedAt: Date.now()
            }
        };
    });

    const rootChunkId = LIBRARY_CHUNK_ROOT_ID;
    const rootPayload = {
        schemaVersion: 2,
        updatedAt: Date.now(),
        chunkIds: orderedChunkIds,
        albums: (chunkBuckets.get(rootChunkId) || []).map((item) => {
            const sanitized = { ...item };
            delete sanitized._chunkId;
            return sanitized;
        }),
        todos: Array.isArray(payload.todos) ? payload.todos : [],
        artistTotals: payload.artistTotals || {},
        latestTodo: payload.latestTodo || null,
        slopG: Array.isArray(payload.slopG) ? payload.slopG : [],
        catDeath: Array.isArray(payload.catDeath) ? payload.catDeath : [],
        catBlack: Array.isArray(payload.catBlack) ? payload.catBlack : [],
        catCore: Array.isArray(payload.catCore) ? payload.catCore : [],
        catHeavy: Array.isArray(payload.catHeavy) ? payload.catHeavy : [],
        catEtc: Array.isArray(payload.catEtc) ? payload.catEtc : [],
        catNonMetal: Array.isArray(payload.catNonMetal) ? payload.catNonMetal : []
    };

    latestLibraryChunkId = orderedChunkIds[orderedChunkIds.length - 1] || LIBRARY_CHUNK_ROOT_ID;
    loadedLibraryChunkIds = orderedChunkIds;
    return { rootPayload, chunkPayloads };
}

async function loadChunkedLibraryDataFromFirestore(rootData = {}) {
    const loadedAlbums = [];
    const seenChunkIds = new Set([LIBRARY_CHUNK_ROOT_ID]);

    const pushAlbum = (album, chunkId) => {
        if (!album || typeof album !== "object") return;
        const copy = { ...album };
        copy._chunkId = chunkId;
        loadedAlbums.push(copy);
    };

    const rootAlbums = Array.isArray(rootData.albums) ? rootData.albums : [];
    rootAlbums.forEach((album) => pushAlbum(album, LIBRARY_CHUNK_ROOT_ID));

    const rootChunkIds = Array.isArray(rootData.chunkIds) ? rootData.chunkIds : [];
    rootChunkIds.forEach((chunkId) => {
        const normalized = String(chunkId || "").trim();
        if (normalized) seenChunkIds.add(normalized);
    });

    let counter = 2;
    while (true) {
        const chunkId = `library_${counter}`;
        try {
            const snap = await getDoc(doc(db, "data", chunkId));
            if (!snap || !snap.exists()) break;
            const chunkData = snap.data() || {};
            const chunkAlbums = Array.isArray(chunkData.albums) ? chunkData.albums : [];
            chunkAlbums.forEach((album) => pushAlbum(album, chunkId));
            seenChunkIds.add(chunkId);
            counter += 1;
        } catch (err) {
            console.warn("Chunk load failed:", err);
            break;
        }
    }

    const orderedChunkIds = sortLibraryChunkIds([LIBRARY_CHUNK_ROOT_ID, ...Array.from(seenChunkIds).filter((chunkId) => chunkId !== LIBRARY_CHUNK_ROOT_ID)]);
    latestLibraryChunkId = orderedChunkIds[orderedChunkIds.length - 1] || LIBRARY_CHUNK_ROOT_ID;
    loadedLibraryChunkIds = orderedChunkIds;

    return {
        albums: loadedAlbums,
        todos: Array.isArray(rootData.todos) ? rootData.todos : [],
        artistTotals: rootData.artistTotals || {},
        latestTodo: rootData.latestTodo || null,
        slopG: Array.isArray(rootData.slopG) ? rootData.slopG : [],
        catDeath: Array.isArray(rootData.catDeath) ? rootData.catDeath : [],
        catBlack: Array.isArray(rootData.catBlack) ? rootData.catBlack : [],
        catCore: Array.isArray(rootData.catCore) ? rootData.catCore : [],
        catHeavy: Array.isArray(rootData.catHeavy) ? rootData.catHeavy : [],
        catEtc: Array.isArray(rootData.catEtc) ? rootData.catEtc : [],
        catNonMetal: Array.isArray(rootData.catNonMetal) ? rootData.catNonMetal : []
    };
}

async function loadFromFirebase() {
    const applyLibraryData = (data) => {
        albums = data.albums || [];
        todos = (data.todos || []).map(normalizeTodoItem);
        artistTotals = data.artistTotals || {};
        latestTodo = data.latestTodo || null;
        if (data.slopG !== undefined) slopG = data.slopG;
        catDeath = data.catDeath || [];
        catBlack = data.catBlack || [];
        catCore = data.catCore || [];
        catHeavy = data.catHeavy || [];
        catEtc = data.catEtc || [];
        catNonMetal = data.catNonMetal || [];

        state.albums = albums;
        state.todos = todos;
        state.artistTotals = artistTotals;
        state.slopG = slopG;
        state.catDeath = catDeath;
        state.catBlack = catBlack;
        state.catCore = catCore;
        state.catHeavy = catHeavy;
        state.catEtc = catEtc;
        state.catNonMetal = catNonMetal;
    };

    const applyRealtimeUiRefresh = () => {
        const activePage = document.querySelector(".page.active");
        const activePageId = activePage ? activePage.id : "";

        if (activePageId === "library" && typeof window.runFilter === "function") {
            window.runFilter();
        }
        if (activePageId === "todo" && typeof window.renderTodo === "function") {
            window.renderTodo();
        }
        if (activePageId === "todo-list-view" && typeof window.renderTodoListView === "function") {
            window.renderTodoListView();
        }
        if (activePageId === "stats" && typeof window.renderStats === "function") {
            window.renderStats();
        }
        if (activePageId === "gallery" && typeof window.renderGallery === "function") {
            window.renderGallery();
        }
        if (typeof window.renderLatestTodoBanner === "function") {
            window.renderLatestTodoBanner();
        }
    };

    const startRealtimeLibrarySync = () => {
        if (libraryRealtimeUnsub) return;

        const docRef = doc(db, "data", "library");
        libraryRealtimeUnsub = onSnapshot(docRef, async (snap) => {
            if (!snap.exists()) return;

            try {
                const data = await loadChunkedLibraryDataFromFirestore(snap.data() || {});
                applyLibraryData(data);

                try {
                    localStorage.setItem(LIBRARY_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
                } catch (cacheWriteErr) {
                    console.warn("Realtime cache irasi hiba:", cacheWriteErr);
                }

                applyRealtimeUiRefresh();
            } catch (err) {
                console.warn("Realtime library sync hiba:", err);
            }
        }, (err) => {
            console.warn("Realtime library sync hiba:", err);
        });
    };

    try {
        try {
            const cachedRaw = localStorage.getItem(LIBRARY_CACHE_KEY);
            if (cachedRaw) {
                const cached = JSON.parse(cachedRaw);
                if (cached && cached.data) {
                    applyLibraryData(cached.data);
                    window.showPage("library");
                    if (typeof window.renderSettings === "function") window.renderSettings();
                    if (typeof window.renderLatestTodoBanner === "function") window.renderLatestTodoBanner();
                }
            }
        } catch (cacheReadErr) {
            console.warn("Cache olvasasi hiba:", cacheReadErr);
        }

        const docRef = doc(db, "data", "library");
        let docSnap;
        try {
            docSnap = await getDoc(docRef);
        } catch (readErr) {
            console.warn("Firestore read failed (may require auth):", readErr);
        }

        if (docSnap && docSnap.exists()) {
            const data = await loadChunkedLibraryDataFromFirestore(docSnap.data() || {});
            applyLibraryData(data);

            try {
                localStorage.setItem(LIBRARY_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
            } catch (cacheWriteErr) {
                console.warn("Cache irasi hiba:", cacheWriteErr);
            }
        } else {
            // Firestore doc not available (permission or missing). Try public Cloud Storage mirror.
            try {
                const publicRef = ref(storage, "public/library.json");
                const url = await getDownloadURL(publicRef);
                const resp = await fetch(url);
                if (resp.ok) {
                    const data = await resp.json();
                    const rehydrated = await loadChunkedLibraryDataFromFirestore(data);
                    applyLibraryData(rehydrated);
                    try {
                        localStorage.setItem(LIBRARY_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: rehydrated }));
                    } catch (cacheWriteErr) {
                        console.warn("Cache irasi hiba:", cacheWriteErr);
                    }
                } else {
                    // fallback to local cached settings/todos
                    todos = (JSON.parse(localStorage.getItem("slopTodo")) || []).map(normalizeTodoItem);
                    slopG = JSON.parse(localStorage.getItem("slopSettings")) || [];

                    state.todos = todos;
                    state.slopG = slopG;
                }
            } catch (publicErr) {
                console.warn("Public mirror load failed:", publicErr);
                todos = (JSON.parse(localStorage.getItem("slopTodo")) || []).map(normalizeTodoItem);
                slopG = JSON.parse(localStorage.getItem("slopSettings")) || [];

                state.todos = todos;
                state.slopG = slopG;
            }
        }

        window.showPage("library");
        if (typeof window.renderSettings === "function") window.renderSettings();
        if (typeof window.renderLatestTodoBanner === "function") window.renderLatestTodoBanner();
        startRealtimeLibrarySync();
        handleDeepLinkFromUrl();
    } catch (e) {
        console.error("Hiba a betoltes soran:", e);
        startRealtimeLibrarySync();
        handleDeepLinkFromUrl();
    }
}

async function saveToFirebase() {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    if (offline) {
        console.warn("[Firestore] Offline detected. Writes may be cached locally and will sync when connection returns.");
    }

    try {
        const payload = {
            albums,
            todos,
            artistTotals,
            latestTodo: latestTodo || null,
            slopG,
            catDeath,
            catBlack,
            catCore,
            catHeavy,
            catEtc,
            catNonMetal
        };
        const { rootPayload, chunkPayloads } = buildChunkedLibraryPayload(payload);

        await setDoc(doc(db, "data", "library"), rootPayload);

        await Promise.all(chunkPayloads.map(({ chunkId, data }) => setDoc(doc(db, "data", chunkId), data)));

        // Also update a public JSON mirror in Cloud Storage so unauthenticated users can read latest data.
        try {
            const publicPayload = {
                ...payload,
                albums: (payload.albums || []).map((item) => {
                    const sanitized = { ...item };
                    delete sanitized._chunkId;
                    return sanitized;
                })
            };
            const publicRef = ref(storage, "public/library.json");
            const blob = new Blob([JSON.stringify(publicPayload)], { type: "application/json" });
            await uploadBytes(publicRef, blob);
            // attempt to warm/get URL (may fail for non-public rules)
            try {
                const url = await getDownloadURL(publicRef);
                console.log("Public library mirror updated:", url);
            } catch (urlErr) {
                console.warn("Could not obtain public mirror URL:", urlErr);
            }
        } catch (mirrorErr) {
            console.warn("Updating public mirror failed:", mirrorErr);
        }

        try {
            localStorage.setItem(LIBRARY_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: payload }));
        } catch (cacheWriteErr) {
            console.warn("Cache irasi hiba:", cacheWriteErr);
        }

        window.__lastFirebaseSave = {
            ok: true,
            error: null,
            at: Date.now()
        };

        return { ok: true };
    } catch (e) {
        const code = e && e.code ? e.code : "unknown";
        const message = e && e.message ? e.message : String(e);

        console.error(`[Firestore] Save failed. code=${code} message=${message}`, e);

        if (offline) {
            console.warn("[Firestore] Offline write may be cached locally instead of reaching server immediately.");
        }

        window.__lastFirebaseSave = {
            ok: false,
            error: e,
            at: Date.now()
        };

        return { ok: false, error: e };
    }
}
window.saveToFirebase = saveToFirebase;

window.renderLatestTodoBanner = function() {
    const banner = document.getElementById("latest-todo-banner");
    if (!banner) return;
    if (!latestTodo) {
        banner.style.display = "none";
        banner.innerHTML = "";
        return;
    }
    const t = latestTodo;
    const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const cover = esc(t.coverUrl || "https://via.placeholder.com/120");
    const artist = esc(t.artist || "");
    const album = esc(t.album || "");
    const hasLink = Boolean(t.albumLink);
    const safeLink = hasLink ? encodeURIComponent(t.albumLink) : "";

    banner.style.display = "block";
    banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:14px; background:linear-gradient(90deg,#1a1a1a 0%,#1e1e1e 100%); border:1px solid #333; border-left:4px solid var(--accent); border-radius:10px; padding:10px 14px; overflow:hidden; margin-bottom:15px;">
            <img src="${cover}" alt="cover" style="width:52px; height:52px; object-fit:cover; border-radius:6px; flex-shrink:0; box-shadow:0 2px 10px rgba(0,0,0,0.6);">
            <div style="flex:1; min-width:0;">
                <div style="font-size:0.68em; color:#888; text-transform:uppercase; letter-spacing:1.2px; margin-bottom:3px;">🎵 Jelenleg hallgatom</div>
                <div style="font-weight:bold; color:var(--accent); font-size:0.92em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${artist}</div>
                <div style="font-size:0.82em; color:#ccc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${album}</div>
            </div>
            <div style="display:flex; gap:8px; flex-shrink:0; align-items:center;">
                <button onclick="window.completeLatestTodo()" title="Pipa – áthelyezés a könyvtárba" style="background:none; border:2px solid #44ff44; color:#44ff44; border-radius:50%; width:36px; height:36px; cursor:pointer; font-size:1.1em; display:flex; align-items:center; justify-content:center; transition:filter 0.2s;" onmouseover="this.style.filter='brightness(1.4)'" onmouseout="this.style.filter='none'">✓</button>
                ${hasLink ? `<button data-link="${safeLink}" onclick="window.open(decodeURIComponent(this.dataset.link), '_blank', 'noopener,noreferrer')" title="Folytatás – link megnyitása" style="background:none; border:2px solid var(--accent); color:var(--accent); border-radius:50%; width:36px; height:36px; cursor:pointer; font-size:1em; display:flex; align-items:center; justify-content:center; transition:filter 0.2s;" onmouseover="this.style.filter='brightness(1.4)'" onmouseout="this.style.filter='none'">▶</button>` : ""}
                <button onclick="window.dismissLatestTodoBanner()" title="Bezárás – csak elrejti a bannert, nem törli a ToDo-ból" style="background:none; border:2px solid #555; color:#888; border-radius:50%; width:36px; height:36px; cursor:pointer; font-size:0.95em; display:flex; align-items:center; justify-content:center; transition:filter 0.2s;" onmouseover="this.style.filter='brightness(1.4)'" onmouseout="this.style.filter='none'">✖</button>
            </div>
        </div>
    `;
};

window.setLatestTodo = async function(todoIdx) {
    const t = todos[todoIdx];
    if (!t) return;
    latestTodo = { ...t };
    await saveToFirebase();
    window.renderLatestTodoBanner();
};

window.dismissLatestTodoBanner = async function() {
    latestTodo = null;
    await saveToFirebase();
    window.renderLatestTodoBanner();
};

window.completeLatestTodo = async function() {
    if (!latestTodo) return;
    const t = latestTodo;

    if (requiresSpotifyForTodo(t)) {
        let isValidSpotifySession = false;
        if (spotifyToken) {
            if (typeof window.isSpotifySessionValid === "function") {
                isValidSpotifySession = await window.isSpotifySessionValid();
            } else {
                isValidSpotifySession = true;
            }
        }

        if (!isValidSpotifySession) {
            spotifyToken = null;
            setPendingSpotifyAction({
                type: "completeLatestTodo",
                artist: t.artist || "",
                album: t.album || "",
                createdAt: Date.now()
            });

            if (typeof window.authSpotify === "function") {
                await window.authSpotify("banner-complete");
            }
            return;
        }
    }

    const idx = todos.findIndex((todo) => todo.artist === t.artist && todo.album === t.album);
    if (idx === -1) {
        latestTodo = null;
        await saveToFirebase();
        window.renderLatestTodoBanner();
        return;
    }
    const prevLen = todos.length;
    await window.moveToRating(idx);
    if (todos.length < prevLen) {
        latestTodo = null;
        await saveToFirebase();
        window.renderLatestTodoBanner();
    }
};

function handleDeepLinkFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const page = params.get("page");
        const openAddTodo = params.get("openAddTodo") === "1";
        const artist = (params.get("artist") || "").trim();
        const todoQuery = (params.get("todoQuery") || "").trim();
        const libraryQuery = (params.get("libraryQuery") || "").trim();
        const libraryArtist = (params.get("libraryArtist") || "").trim();
        const libraryAlbum = (params.get("libraryAlbum") || "").trim();

        if (page === "library") {
            window.showPage("library");
            const searchInput = document.getElementById("gSearch");
            const artistSelect = document.getElementById("fArtist");

            // New dedicated mode: set artist and album fields separately.
            if (libraryArtist || libraryAlbum) {
                if (artistSelect) artistSelect.value = libraryArtist;
                if (searchInput) searchInput.value = libraryAlbum;
                if (typeof window.runFilter === "function") window.runFilter(true);
            } else if (libraryQuery) {
                // Backward compatibility for old deep links.
                if (searchInput) searchInput.value = libraryQuery;
                if (typeof window.runFilter === "function") window.runFilter(true);
            }

            const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
            window.history.replaceState({}, document.title, cleanUrl);
            return;
        }

        if (page === "todo") {
            window.showPage("todo");

            if (openAddTodo) {
                const panel = document.getElementById("mod-addTodo");
                if (panel && panel.style.display !== "block") {
                    window.toggleMod("addTodo");
                }
            }

            if (artist) {
                const artistInput = document.getElementById("todoArtist");
                if (artistInput) {
                    artistInput.value = artist;
                    artistInput.focus();
                }
            }

            if (todoQuery && typeof window.setTodoGenreFilter === "function") {
                window.setTodoGenreFilter(todoQuery);
            }

            const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
            window.history.replaceState({}, document.title, cleanUrl);
        }
    } catch (err) {
        console.warn("Deep link parse hiba:", err);
    }
}

registerExcelTableHandlers({
    TRAIT_VALUES,
    TRAIT_ORDER,
    getAlbums: () => albums,
    saveToFirebase,
    runFilter: () => window.runFilter(),
    buildRecommenderOptions
});

registerGalleryComponents({
    getAlbums: () => albums,
    getIsRainbowMode: () => isRainbowMode,
    setIsRainbowMode: (next) => {
        isRainbowMode = next;
        state.isRainbowMode = next;
    },
    getIsGalleryDetailsMode: () => isGalleryDetailsMode,
    setIsGalleryDetailsMode: (next) => {
        isGalleryDetailsMode = next;
    },
    getCurrentPage: () => currentPage,
    setCurrentPage: (next) => {
        currentPage = next;
        state.currentPage = next;
    },
    runFilter: () => window.runFilter(),
    showPage: (id) => window.showPage(id)
});

registerListAndTodoComponents({
    getAlbums: () => albums,
    getTodos: () => todos,
    getItemsPerPage: () => itemsPerPage,
    getCurrentPage: () => currentPage,
    setCurrentPage: (next) => {
        currentPage = next;
        state.currentPage = next;
    },
    getRecommenderHTML: (recKey) => window.getRecommenderHTML(recKey),
    isMissing
});

registerFilterHandlers({
    getAlbums: () => albums,
    getSortAsc: () => sortAsc,
    getCurrentPage: () => currentPage,
    setCurrentPage: (next) => {
        currentPage = next;
        state.currentPage = next;
    },
    setItemsPerPage: (next) => {
        itemsPerPage = next;
        state.itemsPerPage = next;
    },
    recommenders,
    isMissing,
    renderList: (data) => window.renderList(data),
    showPage: (id) => window.showPage(id)
});

registerStatsHandlers({
    getAlbums: () => albums,
    getTodos: () => todos,
    getArtistTotals: () => artistTotals,
    getSlopGenres: () => slopG,
    getCharts: () => charts,
    getCatDeath: () => catDeath,
    getCatBlack: () => catBlack,
    getCatCore: () => catCore,
    getCatHeavy: () => catHeavy,
    getCatEtc: () => catEtc,
    getCatNonMetal: () => catNonMetal,
    getCurrentGenreLevel: () => currentGenreLevel,
    setCurrentGenreLevel: (next) => {
        currentGenreLevel = next;
        state.currentGenreLevel = next;
    },
    getTopSortAsc: () => topSortAsc,
    setSortAsc: (next) => {
        sortAsc = next;
        state.sortAsc = next;
    },
    isMissing,
    recommenders
});

registerLibraryCrudHandlers({
    getAlbums: () => albums,
    getTodos: () => todos,
    getEditIdx: () => editIdx,
    getLibraryChunkIds: () => loadedLibraryChunkIds,
    getLatestLibraryChunkId: () => latestLibraryChunkId,
    getNextLibraryChunkId: (baseChunkId) => getNextLibraryChunkId(baseChunkId),
    setEditIdx: (next) => {
        editIdx = next;
        state.editIdx = next;
    },
    getTodoEditIdx: () => todoEditIdx,
    setTodoEditIdx: (next) => {
        todoEditIdx = next;
        state.todoEditIdx = next;
    },
    getSpotifyToken: () => spotifyToken,
    storage,
    ref,
    uploadBytes,
    getDownloadURL,
    saveToFirebase,
    renderStats: () => window.renderStats(),
    runFilter: () => window.runFilter(),
    showPage: (id) => window.showPage(id),
    toggleMod: (panel) => window.toggleMod(panel),
    renderTodo: () => window.renderTodo()
});

registerSettingsHandlers({
    getAlbums: () => albums,
    getTodos: () => todos,
    getSlopGenres: () => slopG,
    getCatDeath: () => catDeath,
    getCatBlack: () => catBlack,
    getCatCore: () => catCore,
    getCatHeavy: () => catHeavy,
    getCatEtc: () => catEtc,
    getCatNonMetal: () => catNonMetal,
    saveToFirebase,
    storage,
    ref,
    uploadBytes,
    getDownloadURL
});

registerNavigationHandlers({
    getAlbums: () => albums,
    renderExcelTable: (data) => window.renderExcelTable(data),
    renderGallery: () => window.renderGallery(),
    renderStats: () => window.renderStats(),
    renderWorldMap: () => window.renderWorldMap(),
    initFilters: () => window.initFilters(),
    runFilter: () => window.runFilter(),
    renderSettings: () => window.renderSettings(),
    renderTodo: () => window.renderTodo(),
    renderTodoListView: () => window.renderTodoListView(),
    getSortAsc: () => sortAsc,
    setSortAsc: (next) => {
        sortAsc = next;
        state.sortAsc = next;
    },
    setCurrentPage: (next) => {
        currentPage = next;
        state.currentPage = next;
    },
    getTopSortAsc: () => topSortAsc,
    setTopSortAsc: (next) => {
        topSortAsc = next;
        state.topSortAsc = next;
    }
});

registerAuthHandlers({
    auth,
    provider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    getCurrentUser: () => currentUser,
    setCurrentUser: (next) => {
        currentUser = next;
    },
    showPage: (id) => window.showPage(id),
    runFilter: () => window.runFilter()
});

initSpotifyService({
    getToken: () => spotifyToken,
    setToken: (token) => {
        spotifyToken = token;
    },
    onTrackPicked: (track) => {
        const favSongInput = document.getElementById("inFavSong");
        const songUrlInput = document.getElementById("inSongUrl");
        const addModal = document.getElementById("mod-add");

        if (favSongInput) favSongInput.value = track.name;
        if (songUrlInput) songUrlInput.value = track.external_urls.spotify;
        if (addModal && addModal.style.display === "none") window.toggleMod("add");
    },
    onTokenAcquired: async ({ intent }) => {
        const pendingAction = getPendingSpotifyAction();

        if (intent === "todo-login") {
            window.showPage("todo");
            return;
        }

        if (intent === "banner-complete" || pendingAction?.type === "completeLatestTodo") {
            const tryResumeBannerComplete = async () => {
                if (!latestTodo && pendingAction?.artist && pendingAction?.album) {
                    const found = todos.find((todo) => todo.artist === pendingAction.artist && todo.album === pendingAction.album);
                    if (found) latestTodo = { ...found };
                }

                if (!latestTodo) return false;

                await window.completeLatestTodo();
                return true;
            };

            const resumedNow = await tryResumeBannerComplete();
            if (resumedNow) {
                clearPendingSpotifyAction();
            } else {
                // Data may still be loading right after redirect; retry once shortly.
                window.setTimeout(async () => {
                    const resumedLater = await tryResumeBannerComplete();
                    if (resumedLater) clearPendingSpotifyAction();
                }, 900);
            }
        }
    }
});

registerCsvImport({
    getAlbums: () => albums,
    setAlbums: (nextAlbums) => {
        albums = nextAlbums;
        state.albums = nextAlbums;
    },
    saveToFirebase
});

initMobileHeaderAutoHide();
registerHueExtraction();
loadFromFirebase();

if (document.getElementById("gSearch") && document.getElementById("sortField")) {
    window.initFilters();
    window.runFilter();
}
