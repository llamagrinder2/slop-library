export function registerExcelTableHandlers({
    TRAIT_VALUES,
    TRAIT_ORDER,
    getAlbums,
    saveToFirebase,
    runFilter,
    buildRecommenderOptions
}) {
    let currentSortField = "";
    let currentSortAsc = true;

    function initResizers() {
        const table = document.querySelector(".excel-table");
        if (!table) return;

        const cols = table.querySelectorAll("th");
        cols.forEach((col) => {
            if (col.querySelector(".resizer")) return;

            const resizer = document.createElement("div");
            resizer.classList.add("resizer");
            col.appendChild(resizer);

            let startX;
            let startWidth;

            resizer.addEventListener("mousedown", (e) => {
                startX = e.pageX;
                startWidth = col.offsetWidth;

                const onMouseMove = (ev) => {
                    const newWidth = startWidth + (ev.pageX - startX);
                    col.style.width = newWidth + "px";
                };

                const onMouseUp = () => {
                    document.removeEventListener("mousemove", onMouseMove);
                    document.removeEventListener("mouseup", onMouseUp);
                };

                document.addEventListener("mousemove", onMouseMove);
                document.addEventListener("mouseup", onMouseUp);
            });
        });
    }

    window.renderExcelTable = function(data) {
        const body = document.getElementById("excelBody");
        if (!body) return;

        const makeTraitSelect = (id, field, val) => `
            <select class="inline-edit" onchange="window.updateAlbumField('${id}', 'traits.${field}', this.value)">
                ${TRAIT_VALUES.map((opt) => `<option value="${opt}" ${val === opt ? "selected" : ""}>${opt}</option>`).join("")}
            </select>
        `;

        body.innerHTML = data
            .map((a) => {
                const t = a.traits || { riff: "-", vox: "-", dob: "-", mix: "-", szoveg: "-", vibe: "-" };

                return `
                <tr>
                    <td>${a.id}</td>
                    <td contenteditable="true" onfocus="this.dataset.oldValue=this.innerText" onblur="handleCellEdit(this, '${a.id}', 'artist')" style="color:white; font-weight:bold;">${a.artist}</td>
                    <td contenteditable="true" onfocus="this.dataset.oldValue=this.innerText" onblur="handleCellEdit(this, '${a.id}', 'album')">${a.album}</td>
                    <td contenteditable="true" onfocus="this.dataset.oldValue=this.innerText" onblur="handleCellEdit(this, '${a.id}', 'year')">${a.year || ""}</td>
                    <td contenteditable="true" onfocus="this.dataset.oldValue=this.innerText" onblur="handleCellEdit(this, '${a.id}', 'genre')">${a.genre || ""}</td>
                    <td>
                        <select class="inline-edit" onchange="updateAlbumField('${a.id}', 'recommender', this.value)">
                            ${buildRecommenderOptions(a.recommender)}
                        </select>
                    </td>
                    <td contenteditable="true" onfocus="this.dataset.oldValue=this.innerText" onblur="handleCellEdit(this, '${a.id}', 'myScore')" style="color:var(--accent); font-weight:bold;">${a.myScore}</td>
                    <td contenteditable="true" onfocus="this.dataset.oldValue=this.innerText" onblur="handleCellEdit(this, '${a.id}', 'review')" class="col-review" title="${a.review || ""}">${a.review || ""}</td>
                    <td>${makeTraitSelect(a.id, "riff", t.riff)}</td>
                    <td>${makeTraitSelect(a.id, "vox", t.vox)}</td>
                    <td>${makeTraitSelect(a.id, "dob", t.dob)}</td>
                    <td>${makeTraitSelect(a.id, "mix", t.mix)}</td>
                    <td>${makeTraitSelect(a.id, "szoveg", t.szoveg)}</td>
                    <td>${makeTraitSelect(a.id, "vibe", t.vibe)}</td>
                    <td contenteditable="true" onfocus="this.dataset.oldValue=this.innerText" onblur="handleCellEdit(this, '${a.id}', 'favSong')" title="${a.favSong || ""}">${a.favSong || ""}</td>
                    <td contenteditable="true" onfocus="this.dataset.oldValue=this.innerText" onblur="handleCellEdit(this, '${a.id}', 'songUrl')">${a.songUrl || ""}</td>
                    <td contenteditable="true" onfocus="this.dataset.oldValue=this.innerText" onblur="handleCellEdit(this, '${a.id}', 'coverUrl')">${a.coverUrl || ""}</td>
                </tr>`;
            })
            .join("");

        initResizers();
    };

    window.handleCellEdit = function(cell, albumId, field) {
        const newValue = cell.innerText.trim();
        const oldValue = (cell.dataset.oldValue || "").trim();

        if (newValue !== oldValue) {
            window.updateAlbumField(albumId, field, newValue);
            cell.dataset.oldValue = newValue;

            cell.style.transition = "background 0.3s";
            cell.style.backgroundColor = "rgba(139, 195, 74, 0.5)";
            setTimeout(() => {
                cell.style.backgroundColor = "transparent";
            }, 500);
        }
    };

    window.updateAlbumField = async function(albumId, fieldPath, newValue) {
        const albums = getAlbums();
        const index = albums.findIndex((a) => a.id == albumId);
        if (index === -1) {
            console.error("Nem talalom az albumot ezzel az ID-val:", albumId);
            return;
        }

        if (fieldPath.startsWith("traits.")) {
            const trait = fieldPath.split(".")[1];
            if (!albums[index].traits) albums[index].traits = {};
            albums[index].traits[trait] = newValue;
        } else if (fieldPath === "myScore") {
            albums[index][fieldPath] = parseFloat(newValue) || 0;
        } else {
            albums[index][fieldPath] = newValue;
        }

        try {
            await saveToFirebase();
            runFilter();
        } catch (error) {
            console.error("Hiba menteskor:", error);
        }
    };

    window.sortExcelTable = function(event, field, thElement) {
        if (event.target.classList.contains("resizer")) return;

        if (currentSortField === field) currentSortAsc = !currentSortAsc;
        else {
            currentSortField = field;
            currentSortAsc = true;
        }

        const albums = getAlbums();
        albums.sort((a, b) => {
            let valA = a[field] || "";
            let valB = b[field] || "";

            if (field.startsWith("traits.")) {
                const trait = field.split(".")[1];
                valA = a.traits && a.traits[trait] ? a.traits[trait] : "";
                valB = b.traits && b.traits[trait] ? b.traits[trait] : "";

                valA = TRAIT_ORDER[valA] ?? -1;
                valB = TRAIT_ORDER[valB] ?? -1;
                return currentSortAsc ? valA - valB : valB - valA;
            }

            if (field === "myScore" || field === "year" || field === "id") {
                valA = Number(valA) || 0;
                valB = Number(valB) || 0;
                return currentSortAsc ? valA - valB : valB - valA;
            }

            valA = valA.toString().toLowerCase();
            valB = valB.toString().toLowerCase();

            if (valA < valB) return currentSortAsc ? -1 : 1;
            if (valA > valB) return currentSortAsc ? 1 : -1;
            return 0;
        });

        document.querySelectorAll(".excel-table th").forEach((th) => {
            th.classList.remove("sort-asc", "sort-desc");
        });

        if (thElement) thElement.classList.add(currentSortAsc ? "sort-asc" : "sort-desc");
        window.renderExcelTable(albums);
    };
}
