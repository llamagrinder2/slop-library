import { getCountryFlag, normalizeCountryCode } from "../core/countries.js";

export function registerListAndTodoComponents({
    getAlbums,
    getTodos,
    getItemsPerPage,
    getCurrentPage,
    setCurrentPage,
    getRecommenderHTML,
    isMissing
}) {
    let cloudToastTimer = null;

    const getCloudToastEl = () => {
        let el = document.getElementById("cloudSaveToast");
        if (el) return el;

        el = document.createElement("div");
        el.id = "cloudSaveToast";
        el.style.position = "fixed";
        el.style.right = "16px";
        el.style.bottom = "16px";
        el.style.zIndex = "20000";
        el.style.minWidth = "240px";
        el.style.maxWidth = "420px";
        el.style.padding = "10px 14px";
        el.style.borderRadius = "8px";
        el.style.fontSize = "13px";
        el.style.fontWeight = "600";
        el.style.color = "#fff";
        el.style.background = "#2d2d2d";
        el.style.border = "1px solid #555";
        el.style.boxShadow = "0 6px 24px rgba(0,0,0,0.35)";
        el.style.display = "none";
        document.body.appendChild(el);
        return el;
    };

    const showCloudToast = (type, message) => {
        const injected = typeof window.__showCloudSaveToast === "function" ? window.__showCloudSaveToast : null;
        if (injected) {
            injected(type, message);
            return;
        }

        const el = getCloudToastEl();
        if (cloudToastTimer) {
            clearTimeout(cloudToastTimer);
            cloudToastTimer = null;
        }

        if (type === "loading") {
            el.style.background = "#253244";
            el.style.border = "1px solid #3e5570";
            el.innerText = `⏳ ${message}`;
            el.style.display = "block";
            return;
        }

        if (type === "success") {
            el.style.background = "#1f4d2f";
            el.style.border = "1px solid #2f8a4f";
            el.innerText = `✓ ${message}`;
            el.style.display = "block";
            cloudToastTimer = setTimeout(() => {
                el.style.display = "none";
            }, 2200);
            return;
        }

        el.style.background = "#5a2323";
        el.style.border = "1px solid #b45454";
        el.innerText = `✖ ${message}`;
        el.style.display = "block";
        cloudToastTimer = setTimeout(() => {
            el.style.display = "none";
        }, 4200);
    };

    const getErrorCodeAndMessage = (error) => {
        const code = error && error.code ? error.code : "unknown";
        const message = error && error.message ? error.message : String(error);
        return { code, message };
    };

    const saveToCloudWithFeedback = async (sourceLabel) => {
        showCloudToast("loading", "Saving to cloud...");

        if (typeof navigator !== "undefined" && navigator.onLine === false) {
            console.warn(`[Firestore][${sourceLabel}] Offline detected. Writes may be cached locally instead of server-confirmed immediately.`);
        }

        try {
            if (typeof window.saveToFirebase !== "function") {
                throw new Error("saveToFirebase function is not available.");
            }

            const result = await window.saveToFirebase();
            if (!result || result.ok !== true) {
                throw (result && result.error) || new Error("Save result did not confirm server write.");
            }

            showCloudToast("success", "Successfully saved to server!");
            return true;
        } catch (error) {
            const { code, message } = getErrorCodeAndMessage(error);
            console.error(`[Firestore][${sourceLabel}] Write failed. code=${code} message=${message}`, error);
            showCloudToast("error", `Error: Save failed! ${message}`);
            throw error;
        }
    };

    window.renderPagination = function(totalPages, totalItems) {
        const currentPage = getCurrentPage();
        const itemsPerPage = getItemsPerPage();
        const container = document.getElementById("listContainer");
        if (!container) return;

        const html = `
        <div class="pagination-container">
            <div style="display:flex; align-items:center; gap:10px;">
                <span>Bontas:</span>
                <select onchange="window.changeItemsPerPage(this.value);" style="width:80px; padding:5px;">
                    <option value="10" ${itemsPerPage == 10 ? "selected" : ""}>10</option>
                    <option value="25" ${itemsPerPage == 25 ? "selected" : ""}>25</option>
                    <option value="50" ${itemsPerPage == 50 ? "selected" : ""}>50</option>
                    <option value="100" ${itemsPerPage == 100 ? "selected" : ""}>100</option>
                </select>
                <small style="color:#888;">(Talalatok: ${totalItems})</small>
            </div>
            <div class="page-btns">
                <button class="page-btn" onclick="window.changePage(1);" ${currentPage == 1 ? "disabled" : ""}>«</button>
                ${Array.from({ length: totalPages }, (_, i) => i + 1)
                    .map((p) => {
                        if (totalPages > 10 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) {
                            return p === 2 || p === totalPages - 1 ? "..." : "";
                        }
                        return `<button class="page-btn ${p === currentPage ? "active" : ""}" onclick="window.changePage(${p});">${p}</button>`;
                    })
                    .join("")
                    .replace(/\.\.\.\.\.\./g, "...")}
                <button class="page-btn" onclick="window.changePage(${totalPages});" ${currentPage == totalPages ? "disabled" : ""}>»</button>
            </div>
        </div>`;

        container.innerHTML += html;
    };

    window.renderList = function(data) {
        const albums = getAlbums();
        const scrollPos = window.scrollY;
        const container = document.getElementById("listContainer");
        if (!container) return;

        container.innerHTML = "";
        const totalItems = data.length;
        const totalPages = Math.ceil(totalItems / getItemsPerPage());

        if (getCurrentPage() > totalPages) setCurrentPage(totalPages || 1);

        const start = (getCurrentPage() - 1) * getItemsPerPage();
        const end = start + getItemsPerPage();
        const paginatedData = data.slice(start, end);

        paginatedData.forEach((a) => {
            const idx = albums.indexOf(a);
            const resizedCover = String(a.cover640Url || "").trim();
            const originalCover = String(a.coverUrl || "").trim();
            const displayCover = resizedCover || originalCover || "https://via.placeholder.com/120";
            const fallbackCover = originalCover || "https://via.placeholder.com/120";
            const safeFallbackCover = fallbackCover.replace(/'/g, "\\'");
            const safeLightboxCover = String(a.coverUrl || displayCover).replace(/'/g, "\\'");
            const isExternal = displayCover && !displayCover.includes("firebasestorage");
            const incomplete = isMissing(a.review) || isMissing(a.favSong) || isMissing(a.coverUrl) || isMissing(a.year) || isMissing(a.album) || isMissing(a.genre);

            const songLabel = a.myScore > 4.5 ? "Kiemelkedo dal:" : "Legkevesbe rossz dal:";
            const getTClass = (val) => {
                if (val === "Peak") return "t-peak";
                if (val === "Igen") return "t-igen";
                if (val === "Nem") return "t-nem";
                if (val === "Volt??") return "t-volt";
                if (val === "Poop") return "t-poop";
                return "t-meh";
            };

            const t = a.traits || { riff: "Meh", vox: "Meh", dob: "Meh", mix: "Meh", szoveg: "Meh", vibe: "Meh" };
            const traitsHtml = `
                <div class="traits-container">
                    <div class="traits-title">Teccet-e?</div>
                    <div class="trait-pill"><span class="trait-name">RIFFEK</span><span class="${getTClass(t.riff)}">${t.riff}</span></div>
                    <div class="trait-pill"><span class="trait-name">VOX</span><span class="${getTClass(t.vox)}">${t.vox}</span></div>
                    <div class="trait-pill"><span class="trait-name">DOBOK</span><span class="${getTClass(t.dob)}">${t.dob}</span></div>
                    <div class="trait-pill"><span class="trait-name">MIX</span><span class="${getTClass(t.mix)}">${t.mix}</span></div>
                    <div class="trait-pill"><span class="trait-name">SZOVEG</span><span class="${getTClass(t.szoveg)}">${t.szoveg}</span></div>
                    <div class="trait-pill"><span class="trait-name">VIBE</span><span class="${getTClass(t.vibe)}">${t.vibe}</span></div>
                </div>`;

            container.innerHTML += `
                <div class="album-card ${incomplete ? "incomplete-card" : ""}" id="card-${idx}" ondragover="event.preventDefault(); this.classList.add('drag-over');" ondragleave="this.classList.remove('drag-over');" ondrop="handleDiskDrop(event, ${idx})">
                    <div class="row-number ${incomplete ? "incomplete-row" : ""}">#${a.id || "?"}</div>
                    <div class="album-art-container">
                        ${isExternal ? "<div class=\"external-link-indicator\" title=\"Kulso hivatkozas\">🔗</div>" : ""}
                        <img src="${displayCover}" class="album-art-blur" onerror="if(this.dataset.fallbackApplied==='1') return; this.dataset.fallbackApplied='1'; this.src='${safeFallbackCover}'">
                        <img src="${displayCover}" class="album-art" onclick="openLB('${safeLightboxCover}')" onerror="if(this.dataset.fallbackApplied==='1') return; this.dataset.fallbackApplied='1'; this.src='${safeFallbackCover}'">
                    </div>
                    <div class="album-info">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <h3 class="artist-name" style="margin:0; ${incomplete ? "color:#E86600;" : ""}" onclick="qFilter('a', '${a.artist.replace(/'/g, "\\'")}')">${a.artist}</h3>
                                    ${getCountryFlag(a.country)}
                                    ${incomplete ? "<span class=\"incomplete-badge\">Hianyos!!</span>" : ""}
                                </div>
                                <p style="margin-top:5px;"><strong>${a.album} ( ${a.length || '-'} )</strong> (${a.year || "?"})</p>
                            </div>
                            <div style="display:flex; align-items:center; gap:10px;">
                                ${getRecommenderHTML(a.recommender)}
                                <div class="score-badge" style="background:hsl(${(a.myScore - 1) * 13},70%,40%); position:static;">${parseFloat(a.myScore).toFixed(1)}</div>
                            </div>
                        </div>
                        <small>${a.genre}</small>
                        ${a.review ? `<p class=\"review-text\">${a.review}</p>` : ""}
                        ${traitsHtml}
                        ${a.favSong ? `<div class=\"song-container\"><span class=\"song-label\">${songLabel}</span><a href=\"${a.songUrl}\" target=\"_blank\" class=\"fav-song-link\">${a.favSong}</a></div>` : ""}
                        <div style="margin-top:auto; padding-top:15px; display:flex; align-items:center; gap:10px; font-size:0.8em;">
                            <span style="color:#666;">hozzaadva: <strong style="color:#888;">${a.addedDate || "Osidokben"}</strong></span>
                            <button data-html2canvas-ignore class="edit-btn" onclick="editAlbum(${idx})" style="background:none; border:none; color:var(--accent); cursor:pointer; font-weight:bold; padding:0; text-decoration:underline;">✎ SZERKESZTES</button>
                        </div>
                    </div>
                    <button data-html2canvas-ignore class="btn-snap" onclick="captureCard(this.parentElement, '${a.album.replace(/'/g, "\\'")}')" title="Kep mentese">📷</button>
                    <button data-html2canvas-ignore class="btn-del" onclick="deleteAlbum(${idx}, 'lib')">✖</button>
                </div>`;
        });

        if (totalItems > 0) window.renderPagination(totalPages, totalItems);
        window.scrollTo(0, scrollPos);
    };

    window.setTodoGenreFilter = function(query) {
        window.todoGenreFilter = (query || "").trim();
        const input = document.getElementById("todoGenreFilter");
        if (input && input.value !== window.todoGenreFilter) input.value = window.todoGenreFilter;
        window.renderTodo();
    };

    window.setTodoLengthFilter = function(range) {
        window.todoLengthFilter = String(range || "").trim();
        const select = document.getElementById("todoLengthFilter");
        if (select && select.value !== window.todoLengthFilter) select.value = window.todoLengthFilter;
        window.renderTodo();
    };

    window.clearTodoGenreFilter = function() {
        window.todoGenreFilter = "";
        window.todoLengthFilter = "";

        const input = document.getElementById("todoGenreFilter");
        if (input) input.value = "";

        const select = document.getElementById("todoLengthFilter");
        if (select) select.value = "";

        window.renderTodo();
    };

    const parseLengthToSeconds = (lengthValue) => {
        const raw = String(lengthValue || "").trim();
        if (!raw) return null;

        if (/^\d+$/.test(raw)) {
            return parseInt(raw, 10) * 60;
        }

        const parts = raw.split(":").map((p) => p.trim());
        if (parts.length === 2) {
            const minutes = parseInt(parts[0], 10);
            const seconds = parseInt(parts[1], 10);
            if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds < 0 || seconds > 59) return null;
            return minutes * 60 + seconds;
        }

        if (parts.length === 3) {
            const hours = parseInt(parts[0], 10);
            const minutes = parseInt(parts[1], 10);
            const seconds = parseInt(parts[2], 10);
            if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds) || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) return null;
            return hours * 3600 + minutes * 60 + seconds;
        }

        return null;
    };

    const matchesLengthFilter = (lengthValue, activeLengthFilter) => {
        if (!activeLengthFilter) return true;

        const seconds = parseLengthToSeconds(lengthValue);
        if (seconds === null) return false;

        if (activeLengthFilter === "0-10") return seconds >= 0 && seconds <= 600;
        if (activeLengthFilter === "10-20") return seconds >= 601 && seconds <= 1200;
        if (activeLengthFilter === "20-30") return seconds >= 1201 && seconds <= 1800;
        if (activeLengthFilter === "30-40") return seconds >= 1801 && seconds <= 2400;
        if (activeLengthFilter === "40-50") return seconds >= 2401 && seconds <= 3000;
        if (activeLengthFilter === "50-60") return seconds >= 3001 && seconds <= 3600;
        if (activeLengthFilter === "60+") return seconds > 3600;

        return true;
    };

    window.updateTodoField = async function(todoIndex, field, value) {
        const todos = getTodos();
        if (!todos[todoIndex]) return;

        const previousValue = todos[todoIndex][field];
        todos[todoIndex][field] = value;

        try {
            await saveToCloudWithFeedback("updateTodoField");
        } catch (e) {
            todos[todoIndex][field] = previousValue;
            const { code, message } = getErrorCodeAndMessage(e);
            console.error(`[Firestore][updateTodoField] rollback applied. code=${code} message=${message}`, e);
        }
    };

    window.toggleTodoPriority = async function(todoIndex) {
        const todos = getTodos();
        const target = todos[todoIndex];
        if (!target) return;

        const nextValue = !Boolean(target.isPrioritized);
        if (nextValue) {
            const prioritizedCount = todos.reduce((sum, item) => sum + (item && item.isPrioritized ? 1 : 0), 0);
            if (prioritizedCount >= 10) {
                showCloudToast("error", "Maximum 10 albumot jelölhetsz meg prioritásként egyszerre!");
                return;
            }
        }

        const previousValue = Boolean(target.isPrioritized);
        target.isPrioritized = nextValue;

        try {
            await saveToCloudWithFeedback("toggleTodoPriority");
            window.renderTodo();
        } catch (error) {
            target.isPrioritized = previousValue;
            const { code, message } = getErrorCodeAndMessage(error);
            console.error(`[Firestore][toggleTodoPriority] rollback applied. code=${code} message=${message}`, error);
            window.renderTodo();
        }
    };

    window.handleTodoBulkCellEdit = function(cell, todoIndex, field) {
        let nextValue = (cell.innerText || "").trim();
        if (field === "country" && nextValue) {
            nextValue = /^[A-Za-z]{3}$/.test(nextValue) ? nextValue.toUpperCase() : normalizeCountryCode(nextValue);
            cell.innerText = nextValue || "";
        }
        window.updateTodoField(todoIndex, field, nextValue);
    };

    window.renderTodoListView = function() {
        const todos = getTodos();
        const container = document.getElementById("todoListViewContainer");
        if (!container) return;

        const preferredColumns = ["artist", "album", "year", "country", "length", "genre", "albumLink", "coverUrl", "recommender"];
        const discoveredColumns = new Set(preferredColumns);

        todos.forEach((t) => {
            Object.keys(t || {}).forEach((k) => {
                if (k !== "id") discoveredColumns.add(k);
            });
        });

        const cols = [...preferredColumns, ...[...discoveredColumns].filter((c) => !preferredColumns.includes(c))];
        const head = cols.map((c) => `<th style="padding:8px; border:1px solid #333; text-align:left; white-space:nowrap;">${c}</th>`).join("");

        const rows = todos
            .map((t, idx) => {
                const cells = cols
                    .map((c) => {
                        const safeVal = String(t[c] ?? "")
                            .replace(/&/g, "&amp;")
                            .replace(/</g, "&lt;")
                            .replace(/>/g, "&gt;");
                        return `<td contenteditable="true" onblur="window.handleTodoBulkCellEdit(this, ${idx}, '${c}')" style="padding:6px 8px; border:1px solid #2b2b2b; background:#141414; color:#ddd; min-width:120px;">${safeVal}</td>`;
                    })
                    .join("");

                return `<tr>
                    <td style="padding:6px; border:1px solid #2b2b2b; text-align:center; color:#888;">${idx + 1}</td>
                    ${cells}
                    <td style="padding:6px; border:1px solid #2b2b2b; text-align:center; white-space:nowrap;">
                        <button class="btn-check" onclick="moveToRating(${idx}); window.renderTodoListView();" style="width:32px; height:32px; font-size:1em;">✓</button>
                        <button class="btn-check" style="width:32px; height:32px; font-size:1em; border-color:#888;color:#888;" onclick="editTodo(${idx}); showPage('todo');">✎</button>
                        <button class="btn-del" onclick="deleteAlbum(${idx}, 'todo'); window.renderTodoListView();" style="position:static; width:32px; height:32px; margin-left:6px;">✖</button>
                    </td>
                </tr>`;
            })
            .join("");

        container.innerHTML = todos.length
            ? `<div class="module-box" style="display:block; padding:0; overflow:auto; border:1px solid #333; background:#111;">
                <table style="width:100%; border-collapse:collapse; min-width:1200px; table-layout:auto;">
                    <thead style="background:#161616; color:#bbb;">
                        <tr>
                            <th style="padding:8px; border:1px solid #333; width:40px;">#</th>
                            ${head}
                            <th style="padding:8px; border:1px solid #333; width:130px;">Művelet</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                </div>`
                : '<div class="module-box" style="display:block; text-align:center; color:#aaa;">Nincs To-Do adat.</div>';
    };

    window.renderTodo = function() {
        const todos = getTodos();
        const container = document.getElementById("todoContainer");
        if (!container) return;

        const filterInput = document.getElementById("todoGenreFilter");
        const lengthSelect = document.getElementById("todoLengthFilter");
        const activeFilter = String(window.todoGenreFilter || filterInput?.value || "").trim().toLowerCase();
        const activeLengthFilter = String(window.todoLengthFilter || lengthSelect?.value || "").trim();
        if (filterInput && filterInput.value !== (window.todoGenreFilter || "")) {
            window.todoGenreFilter = filterInput.value.trim();
        }
        if (lengthSelect && lengthSelect.value !== (window.todoLengthFilter || "")) {
            window.todoLengthFilter = lengthSelect.value;
        }

        const indexedTodos = todos.map((t, idx) => ({ t, idx }));
        const filteredTodos = indexedTodos.filter(({ t }) => {
            const textMatches = !activeFilter || (() => {
                const haystack = [
                    String(t.artist || ""),
                    String(t.album || ""),
                    String(t.genre || ""),
                    String(t.albumLink || "")
                ]
                    .join(" ")
                    .toLowerCase();
                return haystack.includes(activeFilter);
            })();

            const lengthMatches = matchesLengthFilter(t.length, activeLengthFilter);
            return textMatches && lengthMatches;
        });

        // Prioritized albums always render first, preserving original chronological order within each group.
        const prioritizedTodos = [];
        const regularTodos = [];
        filteredTodos.forEach((entry) => {
            if (entry.t && entry.t.isPrioritized) prioritizedTodos.push(entry);
            else regularTodos.push(entry);
        });
        const sortedTodos = [...prioritizedTodos, ...regularTodos];

        container.className = "todo-card-grid";
        container.innerHTML = "";
        sortedTodos.forEach(({ t, idx }) => {
            const rawLink = String(t.albumLink || "");
            const normalizedLink = rawLink.trim().toLowerCase();
            const isTorrentTag = normalizedLink === "torrent";
            const link = normalizedLink;
            let platform = "generic";
            if (isTorrentTag) platform = "torrent";
            else if (link.includes("spotify.com")) platform = "spotify";
            else if (link.includes("youtube.com") || link.includes("youtu.be")) platform = "youtube";
            else if (link.includes("bandcamp.com")) platform = "bandcamp";

            const platformStyleByType = {
                spotify: {
                    border: "#1DB954",
                    glow: "rgba(29, 185, 84, 0.22)",
                    label: "Spotify",
                    icon: "🎧"
                },
                youtube: {
                    border: "#FF0000",
                    glow: "rgba(255, 0, 0, 0.2)",
                    label: "YouTube",
                    icon: "▶"
                },
                bandcamp: {
                    border: "#1DA1F2",
                    glow: "rgba(29, 161, 242, 0.2)",
                    label: "Bandcamp",
                    icon: "✦"
                },
                torrent: {
                    border: "#9B59B6",
                    glow: "rgba(155, 89, 182, 0.26)",
                    label: "TORENT",
                    icon: "⬇"
                },
                generic: {
                    border: "#4b5154",
                    glow: "rgba(100, 100, 100, 0.14)",
                    label: "Link",
                    icon: "🔗"
                }
            };

            const platformStyle = platformStyleByType[platform] || platformStyleByType.generic;
            const cardAccentStyle = t.albumLink
                ? `border-left: 3px solid ${platformStyle.border}; box-shadow: inset 0 0 0 1px ${platformStyle.glow};${isTorrentTag ? " background: linear-gradient(90deg, rgba(155, 89, 182, 0.16) 0%, rgba(155, 89, 182, 0.08) 35%, rgba(34, 34, 34, 1) 100%);" : ""}`
                : "";
            const prioritizedClass = t.isPrioritized ? " todo-prioritized" : "";

            const linkHtml = t.albumLink
                ? isTorrentTag
                    ? `<p style="margin-top:6px;"><span style="display:inline-flex; align-items:center; gap:8px; font-size:0.86em; letter-spacing:0.4px; text-transform:uppercase; color:${platformStyle.border}; border:1px solid ${platformStyle.border}; border-radius:999px; padding:4px 11px; text-decoration:none; font-weight:600; cursor:default;">${platformStyle.icon} ${platformStyle.label}</span></p>`
                    : `<p style="margin-top:6px;"><a href="${t.albumLink}" target="_blank" rel="noopener noreferrer" onclick="window.setLatestTodo(${idx})" style="display:inline-flex; align-items:center; gap:8px; font-size:0.86em; letter-spacing:0.4px; text-transform:uppercase; color:${platformStyle.border}; border:1px solid ${platformStyle.border}; border-radius:999px; padding:4px 11px; text-decoration:none; font-weight:600; transition:filter 0.2s;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='none'">${platformStyle.icon} ${platformStyle.label}</a></p>`
                : "";

            if (t.isPrioritized) {
                container.innerHTML += `
                    <div class="album-card${prioritizedClass}" style="${cardAccentStyle}">
                        <div class="row-number">${idx + 1}</div>
                        <div class="album-art-container">
                            <img src="${t.coverUrl || "https://via.placeholder.com/120"}" class="album-art-blur">
                            <img src="${t.coverUrl || "https://via.placeholder.com/120"}" class="album-art">
                        </div>
                        <div class="album-info">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                <div>
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <h3 class="artist-name todo-artist">${t.artist}</h3>
                                        ${getCountryFlag(t.country)}
                                    </div>
                                    <p class="todo-album"><strong>${t.album} ( ${t.length || '-'} )</strong></p>
                                    <small>${t.genre || ''}</small>
                                    ${linkHtml}
                                </div>
                                ${getRecommenderHTML(t.recommender)}
                            </div>
                            <div style="margin-top:10px; display:flex; gap:10px;">
                                <button class="btn-check" onclick="moveToRating(${idx})">✓</button>
                                <button class="btn-check todo-priority-btn ${t.isPrioritized ? "active" : ""}" title="Prioritás" onclick="window.toggleTodoPriority(${idx})">★</button>
                                <button class="btn-check" style="border-color:#888;color:#888;" onclick="editTodo(${idx})">✎</button>
                            </div>
                            <button class="btn-del" onclick="deleteAlbum(${idx}, 'todo')">✖</button>
                        </div>
                    </div>`;
                return;
            }

            container.innerHTML += `
                <div class="album-card todo-compact-card" style="${cardAccentStyle}">
                    <div class="row-number">${idx + 1}</div>
                    <div class="album-art-container">
                        <img src="${t.coverUrl || "https://via.placeholder.com/120"}" class="album-art-blur">
                        <img src="${t.coverUrl || "https://via.placeholder.com/120"}" class="album-art">
                    </div>
                    <div class="album-info">
                        <div style="display:flex; justify-content:center; align-items:center; gap:8px;">
                            <h3 class="artist-name todo-artist">${t.artist}</h3>
                            ${getCountryFlag(t.country)}
                        </div>
                        <p class="todo-album"><strong>${t.album}</strong></p>
                        <small>${t.genre || ''}</small>
                        <small style="color:#9fa4aa;">(${t.length || '-'})</small>
                        <div class="todo-compact-actions">
                            <button class="btn-check" onclick="moveToRating(${idx})">✓</button>
                            <button class="btn-check todo-priority-btn ${t.isPrioritized ? "active" : ""}" title="Prioritás" onclick="window.toggleTodoPriority(${idx})">★</button>
                            <button class="btn-check" style="border-color:#888;color:#888;" onclick="editTodo(${idx})">✎</button>
                        </div>
                        <div class="todo-compact-link">${linkHtml}</div>
                        <button class="btn-del" onclick="deleteAlbum(${idx}, 'todo')">✖</button>
                    </div>
                </div>`;
        });

        if (sortedTodos.length === 0) {
            container.className = "";
            container.innerHTML = '<div class="module-box" style="text-align:center; color:#aaa;">Nincs talalat ehhez a szurohoz.</div>';
        }
    };
}
