import { normalizeCountryCode } from "../core/countries.js";

export function registerFilterHandlers({
    getAlbums,
    getSortAsc,
    getCurrentPage,
    setCurrentPage,
    setItemsPerPage,
    recommenders,
    isMissing,
    renderList,
    showPage
}) {
    window.statsToLibrary = function(recId) {
        showPage("library");
        const searchInput = document.getElementById("gSearch");
        if (searchInput) {
            searchInput.value = recId;
            setCurrentPage(1);
            window.runFilter();
        }
    };

    window.filterByScore = function(score) {
        showPage("library");
        const searchInput = document.getElementById("gSearch");
        if (searchInput) {
            searchInput.value = score;
            setCurrentPage(1);
            window.runFilter();
            window.scrollTo(0, 0);
        }
    };

    window.changePage = function(pageNumber) {
        setCurrentPage(pageNumber);
        window.runFilter();
        window.scrollTo(0, 0);
    };

    window.changeItemsPerPage = function(amount) {
        setItemsPerPage(parseInt(amount, 10));
        setCurrentPage(1);
        window.runFilter();
    };

    window.resetFilters = function() {
        document.querySelectorAll("#mod-search select, #mod-search input").forEach((i) => {
            i.value = "";
        });

        const albums = getAlbums();
        albums.sort((a, b) => {
            const indexA = albums.indexOf(a);
            const indexB = albums.indexOf(b);
            return indexB - indexA;
        });

        setCurrentPage(1);
        window.runFilter();
    };

    window.qFilter = function(type, val) {
        showPage("library");
        const modSearch = document.getElementById("mod-search");
        if (modSearch) modSearch.style.display = "block";
        window.resetFilters();
        if (type === "g") document.getElementById("fGenre").value = val;
        if (type === "y") document.getElementById("fYear").value = val;
        if (type === "a") document.getElementById("fArtist").value = val;
        if (type === "c") document.getElementById("fCountry").value = val;
        setCurrentPage(1);
        window.runFilter();
    };

    window.initFilters = function() {
        const albums = getAlbums();
        const fill = (id, data, label) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = `<option value="">${label}</option>` + [...new Set(data)].sort().map((d) => `<option value="${d}">${d}</option>`).join("");
        };

        fill("fArtist", albums.map((a) => a.artist), "Osszes eloado");
        fill("fYear", albums.map((a) => a.year).filter((y) => y), "Osszes ev");

        const gs = new Set();
        albums.forEach((a) => a.genre.split(",").forEach((g) => gs.add(g.trim())));
        fill("fGenre", [...gs], "Minden mufaj");

        fill(
            "fCountry",
            albums
                .map((a) => {
                    const raw = String(a.country || "").trim();
                    if (!raw) return "";
                    return normalizeCountryCode(raw) || raw.toUpperCase();
                })
                .filter((c) => c),
            "Minden orszag"
        );
    };

    window.runFilter = function(resetPage = false) {
        if (resetPage) setCurrentPage(1);

        const gSearchEl = document.getElementById("gSearch");
        const fArtistEl = document.getElementById("fArtist");
        const fYearEl = document.getElementById("fYear");
        const fGenreEl = document.getElementById("fGenre");
        const fCountryEl = document.getElementById("fCountry");
        const sortFieldEl = document.getElementById("sortField");

        if (!gSearchEl || !fArtistEl || !fYearEl || !fGenreEl || !fCountryEl || !sortFieldEl) {
            return;
        }

        const albums = getAlbums();
        const q = gSearchEl.value.trim();
        const fA = fArtistEl.value;
        const fY = fYearEl.value;
        const fG = fGenreEl.value;
        const fC = fCountryEl.value;
        const sField = sortFieldEl.value;

        let res = albums.filter((a) => {
            const searchTerm = q.toLowerCase();
            const isIncomplete = isMissing(a.review) || isMissing(a.favSong) || isMissing(a.coverUrl) || isMissing(a.year) || isMissing(a.album) || isMissing(a.genre);

            const recInfo = recommenders[a.recommender] || {};
            const recName = (recInfo.name1 || "").toLowerCase();
            const recKey = String(a.recommender || "").toLowerCase();

            const searchAsNumber = parseFloat(searchTerm);
            const isNumeric = !isNaN(searchAsNumber);
            const scoreMatch = isNumeric && parseFloat(a.myScore) === searchAsNumber;

            let traitMatch = false;
            if (a.traits) {
                traitMatch = Object.values(a.traits).some((val) => val && val.toLowerCase().includes(searchTerm));
            }

            let mQ = false;
            if (searchTerm === "hianyos" || searchTerm === "hiányos") mQ = isIncomplete;
            else if (searchTerm === "nem hianyos" || searchTerm === "nem hiányos") mQ = !isIncomplete;
            else {
                mQ = !q || a.artist.toLowerCase().includes(searchTerm) || a.album.toLowerCase().includes(searchTerm) || recName.includes(searchTerm) || recKey.includes(searchTerm) || scoreMatch || traitMatch;
            }

            const mA = !fA || a.artist === fA;
            const mY = !fY || String(a.year) === fY;
            const mG = !fG || a.genre.split(",").map((g) => g.trim().toLowerCase()).includes(fG.toLowerCase());
            const normalizedCountry = normalizeCountryCode(a.country) || String(a.country || "").trim().toUpperCase();
            const mC = !fC || normalizedCountry === fC;

            return mQ && mA && mY && mG && mC;
        });

        res.sort((a, b) => {
            let valA;
            let valB;
            if (sField === "id") {
                valA = a.id !== undefined ? parseInt(a.id, 10) : albums.indexOf(a);
                valB = b.id !== undefined ? parseInt(b.id, 10) : albums.indexOf(b);
            } else if (sField === "score") {
                valA = parseFloat(a.myScore) || 0;
                valB = parseFloat(b.myScore) || 0;
            } else {
                valA = (a[sField] || "").toString().toLowerCase();
                valB = (b[sField] || "").toString().toLowerCase();
            }

            if (valA < valB) return getSortAsc() ? -1 : 1;
            if (valA > valB) return getSortAsc() ? 1 : -1;
            return 0;
        });

        renderList(res);
    };
}
