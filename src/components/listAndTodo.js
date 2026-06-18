export function registerListAndTodoComponents({
    getAlbums,
    getTodos,
    getItemsPerPage,
    getCurrentPage,
    setCurrentPage,
    getRecommenderHTML,
    isMissing
}) {
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
            const isExternal = a.coverUrl && !a.coverUrl.includes("firebasestorage");
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
                        <img src="${a.coverUrl || "https://via.placeholder.com/120"}" class="album-art-blur">
                        <img src="${a.coverUrl || "https://via.placeholder.com/120"}" class="album-art" onclick="openLB('${a.coverUrl}')">
                    </div>
                    <div class="album-info">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <h3 class="artist-name" style="margin:0; ${incomplete ? "color:#E86600;" : ""}" onclick="qFilter('a', '${a.artist.replace(/'/g, "\\'")}')">${a.artist}</h3>
                                    ${incomplete ? "<span class=\"incomplete-badge\">Hianyos!!</span>" : ""}
                                </div>
                                <p style="margin-top:5px;"><strong>${a.album}</strong> (${a.year || "?"})</p>
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

    window.renderTodo = function() {
        const todos = getTodos();
        const container = document.getElementById("todoContainer");
        if (!container) return;

        container.innerHTML = "";
        todos.forEach((t, i) => {
            const linkHtml = t.albumLink
                ? `<p style="margin-top:4px;"><a href="${t.albumLink}" target="_blank" rel="noopener noreferrer" style="color:var(--accent); font-size:0.85em; text-decoration: underline;">Album link</a></p>`
                : "";

            container.innerHTML += `
                <div class="album-card">
                    <div class="row-number">${i + 1}</div>
                    <div class="album-art-container">
                        <img src="${t.coverUrl || "https://via.placeholder.com/120"}" class="album-art-blur">
                        <img src="${t.coverUrl || "https://via.placeholder.com/120"}" class="album-art">
                    </div>
                    <div class="album-info">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <h3 class="artist-name todo-artist">${t.artist}</h3>
                                <p class="todo-album"><strong>${t.album}</strong></p>
                                ${linkHtml}
                            </div>
                            ${getRecommenderHTML(t.recommender)}
                        </div>
                        <div style="margin-top:10px; display:flex; gap:10px;">
                            <button class="btn-check" onclick="moveToRating(${i})">✓</button>
                            <button class="btn-check" style="border-color:#888;color:#888;" onclick="editTodo(${i})">✎</button>
                        </div>
                        <button class="btn-del" onclick="deleteAlbum(${i}, 'todo')">✖</button>
                    </div>
                </div>`;
        });
    };
}
