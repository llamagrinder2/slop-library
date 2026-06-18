import { db, auth, storage, provider, doc, getDoc, setDoc, signInWithPopup, onAuthStateChanged, signOut, ref, uploadBytes, getDownloadURL } from "./core/firebase.js";
import { TRAIT_VALUES, TRAIT_ORDER, recommenders } from "./core/constants.js";
import { normalizeCountryCode } from "./core/countries.js";
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
let todoEditIdx = state.todoEditIdx;
let slopG = state.slopG;
let rareLimit = state.rareLimit;
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

const isMissing = (val) => {
    if (!val) return true;
    const s = String(val).trim();
    return s === "" || s === "0" || s === "?" || s === "https://via.placeholder.com/120";
};

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
    container.innerHTML = "";

    const countryCounts = albums.reduce((acc, album) => {
        const country = album.country;
        if (country) {
            acc[country] = (acc[country] || 0) + 1;
        }
        return acc;
    }, {});

    const maxAlbums = Math.max(...Object.values(countryCounts));
    const colorScale = d3.scaleLinear().domain([1, maxAlbums]).range(["#444", "#ffcc00"]);

    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3.select(container).append("svg")
        .attr("width", width)
        .attr("height", height);

    const projection = d3.geoMercator()
        .scale(120)
        .translate([width / 2, height / 1.5]);

    const path = d3.geoPath().projection(projection);

    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .on("zoom", (event) => {
            svg.selectAll("path").attr("transform", event.transform);
        });

    svg.call(zoom);

    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background", "#333")
        .style("color", "white")
        .style("padding", "5px 10px")
        .style("border-radius", "5px");

    const world = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");

    svg.append("g")
        .selectAll("path")
        .data(topojson.feature(world, world.objects.countries).features)
        .enter().append("path")
        .attr("d", path)
        .attr("fill", d => {
            const countryCode = d.id;
            const count = countryCounts[countryCode];
            return count ? colorScale(count) : "#2a2a2a";
        })
        .attr("stroke", "#121212")
        .on("mouseover", (event, d) => {
            const countryCode = d.id;
            const count = countryCounts[countryCode] || 0;
            tooltip.transition().duration(200).style("opacity", .9);
            tooltip.html(`${d.properties.name}: ${count} albums`)
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", d => {
            tooltip.transition().duration(500).style("opacity", 0);
        })
        .on("click", (event, d) => {
            const countryCode = d.id;
            if (countryCounts[countryCode]) {
                document.getElementById('fCountry').value = countryCode;
                runFilter();
                showPage('library');
            }
        });
}

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

async function loadFromFirebase() {
    const applyLibraryData = (data) => {
        albums = data.albums || [];
        todos = data.todos || [];
        if (data.slopG !== undefined) slopG = data.slopG;
        if (data.rareLimit !== undefined) rareLimit = data.rareLimit;
        catDeath = data.catDeath || [];
        catBlack = data.catBlack || [];
        catCore = data.catCore || [];
        catHeavy = data.catHeavy || [];
        catEtc = data.catEtc || [];
        catNonMetal = data.catNonMetal || [];

        state.albums = albums;
        state.todos = todos;
        state.slopG = slopG;
        state.rareLimit = rareLimit;
        state.catDeath = catDeath;
        state.catBlack = catBlack;
        state.catCore = catCore;
        state.catHeavy = catHeavy;
        state.catEtc = catEtc;
        state.catNonMetal = catNonMetal;
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
                }
            }
        } catch (cacheReadErr) {
            console.warn("Cache olvasasi hiba:", cacheReadErr);
        }

        const docRef = doc(db, "data", "library");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            applyLibraryData(data);

            try {
                localStorage.setItem(LIBRARY_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
            } catch (cacheWriteErr) {
                console.warn("Cache irasi hiba:", cacheWriteErr);
            }
        } else {
            todos = JSON.parse(localStorage.getItem("slopTodo")) || [];
            slopG = JSON.parse(localStorage.getItem("slopSettings")) || [];
            rareLimit = parseInt(localStorage.getItem("slopRareLimit"), 10) || 8;

            state.todos = todos;
            state.slopG = slopG;
            state.rareLimit = rareLimit;
        }

        window.showPage("library");
        if (typeof window.renderSettings === "function") window.renderSettings();
    } catch (e) {
        console.error("Hiba a betoltes soran:", e);
    }
}

async function saveToFirebase() {
    try {
        const payload = {
            albums,
            todos,
            rareLimit,
            slopG,
            catDeath,
            catBlack,
            catCore,
            catHeavy,
            catEtc,
            catNonMetal
        };

        await setDoc(doc(db, "data", "library"), payload);

        try {
            localStorage.setItem(LIBRARY_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: payload }));
        } catch (cacheWriteErr) {
            console.warn("Cache irasi hiba:", cacheWriteErr);
        }
    } catch (e) {
        console.error("Hiba a mentes soran:", e);
    }
}
window.saveToFirebase = saveToFirebase;

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
    getSlopGenres: () => slopG,
    getRareLimit: () => rareLimit,
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
    getRareLimit: () => rareLimit,
    getSlopGenres: () => slopG,
    getCatDeath: () => catDeath,
    getCatBlack: () => catBlack,
    getCatCore: () => catCore,
    getCatHeavy: () => catHeavy,
    getCatEtc: () => catEtc,
    getCatNonMetal: () => catNonMetal,
    saveToFirebase
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
        document.getElementById("inFavSong").value = track.name;
        document.getElementById("inSongUrl").value = track.external_urls.spotify;
        if (document.getElementById("mod-add").style.display === "none") window.toggleMod("add");
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

window.initFilters();
window.runFilter();
