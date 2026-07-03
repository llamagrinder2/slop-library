import { normalizeCountryCode } from "../core/countries.js";

function formatMs(ms) {
    if (!ms) return "";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function extractSpotifyAlbumId(link) {
    if (!link) return null;
    const match = String(link).match(/open\.spotify\.com\/album\/([a-zA-Z0-9]+)/i);
    return match ? match[1] : null;
}

function askTrackChoice(tracks) {
    if (!tracks || !tracks.length) return null;

    const preview = tracks
        .slice(0, 25)
        .map((t, i) => `${i + 1}. ${t.name}`)
        .join("\n");

    const raw = window.prompt(
        `Valassz kedvenc dalt (ird be a sorszamat).\n\n${preview}\n\n(1-${Math.min(tracks.length, 25)})`,
        "1"
    );

    if (raw === null) return null;
    const idx = Number(raw) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= tracks.length) {
        alert("Ervenytelen dal valasztas.");
        return null;
    }
    return tracks[idx];
}

export function registerLibraryCrudHandlers({
    getAlbums,
    getTodos,
    getEditIdx,
    setEditIdx,
    getTodoEditIdx,
    setTodoEditIdx,
    getSpotifyToken,
    storage,
    ref,
    uploadBytes,
    getDownloadURL,
    saveToFirebase,
    renderStats,
    runFilter,
    showPage,
    toggleMod,
    renderTodo
}) {
    const normalizeArtistKey = (name) => String(name || "").trim().toLowerCase();

    const findCountryForArtist = (artistName) => {
        const target = normalizeArtistKey(artistName);
        if (!target) return "";

        const albums = getAlbums();
        const todos = getTodos();
        const counts = new Map();

        const collect = (items) => {
            items.forEach((item) => {
                if (normalizeArtistKey(item.artist) !== target) return;
                const rawCountry = String(item.country || "").trim();
                if (!rawCountry) return;
                const normalized = normalizeCountryCode(rawCountry);
                if (!normalized) return;
                counts.set(normalized, (counts.get(normalized) || 0) + 1);
            });
        };

        collect(albums);
        collect(todos);

        let best = "";
        let bestCount = -1;
        counts.forEach((count, code) => {
            if (count > bestCount) {
                best = code;
                bestCount = count;
            }
        });
        return best;
    };

    const bindArtistCountryAutofill = (artistInputId, countryInputId) => {
        const artistEl = document.getElementById(artistInputId);
        const countryEl = document.getElementById(countryInputId);
        if (!artistEl || !countryEl) return;
        if (artistEl.dataset.countryAutofillBound === "1") return;

        const tryAutofill = () => {
            const currentCountry = String(countryEl.value || "").trim();
            if (currentCountry) return;
            const code = findCountryForArtist(artistEl.value);
            if (code) countryEl.value = code;
        };

        artistEl.addEventListener("blur", tryAutofill);
        artistEl.addEventListener("change", tryAutofill);
        artistEl.dataset.countryAutofillBound = "1";
    };

    const capitalizeGenreWords = (value) =>
        String(value || "").replace(/(^|[\s,;\/\-()])([a-zA-ZÀ-ÿ])/g, (match, sep, firstChar) => {
            return `${sep}${firstChar.toUpperCase()}`;
        });

    const bindGenreAutoCapitalize = (inputId) => {
        const inputEl = document.getElementById(inputId);
        if (!inputEl) return;
        if (inputEl.dataset.genreAutoCapBound === "1") return;

        const applyCapitalize = () => {
            const current = String(inputEl.value || "");
            const next = capitalizeGenreWords(current);
            if (next === current) return;

            const cursorStart = inputEl.selectionStart;
            const cursorEnd = inputEl.selectionEnd;
            inputEl.value = next;

            if (typeof cursorStart === "number" && typeof cursorEnd === "number") {
                inputEl.setSelectionRange(cursorStart, cursorEnd);
            }
        };

        inputEl.addEventListener("input", applyCapitalize);
        inputEl.addEventListener("blur", applyCapitalize);
        inputEl.dataset.genreAutoCapBound = "1";
    };

    bindArtistCountryAutofill("inArtist", "inCountry");
    bindArtistCountryAutofill("todoArtist", "todoCountry");
    bindGenreAutoCapitalize("inGenre");
    bindGenreAutoCapitalize("todoGenre");

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

    window.__showCloudSaveToast = showCloudToast;

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
            const result = await saveToFirebase();
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

    window.saveAlbum = async function() {
        const albums = getAlbums();
        const editIdx = getEditIdx();
        const isEditing = editIdx > -1;
        const previousAlbum = isEditing ? { ...albums[editIdx] } : null;

        const saveBtn = document.querySelector('button[onclick="saveAlbum()"]');
        const originalSaveText = saveBtn ? saveBtn.innerText : "";
        if (saveBtn) saveBtn.disabled = true;
        if (saveBtn) saveBtn.innerText = "Mentes...";

        const fileInput = document.getElementById("fileCover");
        const urlInput = document.getElementById("inCover");
        let finalCoverUrl = urlInput ? urlInput.value.trim() : "";

        if (fileInput?.files?.[0]) {
            const file = fileInput.files[0];
            const fileName = Date.now() + "_" + file.name;
            const storageRef = ref(storage, "album_covers/" + fileName);

            try {
                const snapshot = await uploadBytes(storageRef, file);
                finalCoverUrl = await getDownloadURL(snapshot.ref);
            } catch (error) {
                console.error("Hiba a feltoltesnel:", error);
                alert("Kepfeltoltes sikertelen!");
                if (saveBtn) saveBtn.disabled = false;
                if (saveBtn) saveBtn.innerText = originalSaveText;
                return;
            }
        }

        const dateEl = document.getElementById("inDate");
        const dateInput = dateEl ? dateEl.value : "";
        const traits = {
            riff: document.getElementById("t_riff").value,
            vox: document.getElementById("t_vox").value,
            dob: document.getElementById("t_dob").value,
            mix: document.getElementById("t_mix").value,
            szoveg: document.getElementById("t_szoveg").value,
            vibe: document.getElementById("t_vibe").value
        };

        const maxId = albums.length > 0 ? Math.max(...albums.map((a) => a.id || 0)) : 0;
        const countryInput = document.getElementById("inCountry");
        let countryValue = "";
        if (countryInput && countryInput.value.trim()) {
            const rawVal = countryInput.value.trim();
            if (/^[A-Za-z]{3}$/.test(rawVal)) {
                countryValue = rawVal.toUpperCase();
            } else {
                const normalized = normalizeCountryCode(rawVal);
                countryValue = normalized;
            }
        } else {
            countryValue = findCountryForArtist(document.getElementById("inArtist").value);
            if (countryInput && countryValue) countryInput.value = countryValue;
        }
        const coverChanged = isEditing && finalCoverUrl !== (previousAlbum?.coverUrl || "");
        const nextAlbum = {
            ...(isEditing ? albums[editIdx] : {}),
            id: editIdx > -1 ? albums[editIdx].id : maxId + 1,
            artist: document.getElementById("inArtist").value.trim(),
            album: document.getElementById("inAlbum").value.trim(),
            coverUrl: finalCoverUrl,
            cover640Url: isEditing && !coverChanged ? (albums[editIdx].cover640Url || "") : "",
            thumbnailUrl: isEditing && !coverChanged ? (albums[editIdx].thumbnailUrl || "") : "",
            year: document.getElementById("inYear").value,
            country: countryValue,
            genre: document.getElementById("inGenre").value.trim(),
            recommender: document.getElementById("inRec").value,
            myScore: parseFloat(document.getElementById("inScore").value) || 0,
            review: document.getElementById("inReview").value.trim(),
            length: document.getElementById("inLength").value.trim(),
            favSong: document.getElementById("inFavSong").value.trim(),
            songUrl: document.getElementById("inSongUrl").value.trim(),
            traits,
            addedDate: dateInput || "Osidokben"
        };

        if (isEditing) {
            albums[editIdx] = nextAlbum;
        } else {
            albums.push(nextAlbum);
        }

        try {
            await saveToCloudWithFeedback("saveAlbum");
            if (isEditing) setEditIdx(-1);
            renderStats();
            runFilter();
            toggleMod('add');
            document.getElementById("inArtist").value = "";
            document.getElementById("inAlbum").value = "";
            document.getElementById("inCover").value = "";
            document.getElementById("fileCover").value = "";
            document.getElementById("inYear").value = "";
            document.getElementById("inCountry").value = "";
            document.getElementById("inGenre").value = "";
            document.getElementById("inRec").value = "";
            document.getElementById("inScore").value = "";
            document.getElementById("inReview").value = "";
            document.getElementById("inFavSong").value = "";
            document.getElementById("inSongUrl").value = "";
            document.getElementById("inLength").value = "";
            document.getElementById("inDate").value = "";
            document.getElementById("t_riff").value = "Meh";
            document.getElementById("t_vox").value = "Meh";
            document.getElementById("t_dob").value = "Meh";
            document.getElementById("t_mix").value = "Meh";
            document.getElementById("t_szoveg").value = "Meh";
            document.getElementById("t_vibe").value = "Meh";
        } catch (error) {
            const { code, message } = getErrorCodeAndMessage(error);
            if (isEditing && previousAlbum) {
                albums[editIdx] = previousAlbum;
            } else if (!isEditing) {
                albums.pop();
            }
            console.error(`[Firestore][saveAlbum] rollback applied. code=${code} message=${message}`, error);
        } finally {
            if (saveBtn) saveBtn.disabled = false;
            if (saveBtn) saveBtn.innerText = originalSaveText;
        }
    };

    window.handleDiskDrop = async function(e, albumIdx) {
        e.preventDefault();
        e.stopPropagation();

        const albums = getAlbums();
        const card = document.getElementById(`card-${albumIdx}`);
        if (card) card.classList.remove("drag-over");

        const file = e.dataTransfer.files[0];
        if (!file || !file.type.startsWith("image/")) {
            alert("Csak kepfajlt (jpg, png stb.) dobhatsz ra!");
            return;
        }

        if (card) card.style.opacity = "0.4";

        const previousCoverUrl = albums[albumIdx] ? albums[albumIdx].coverUrl : "";
    const previousCover640Url = albums[albumIdx] ? albums[albumIdx].cover640Url : "";
    const previousThumbnailUrl = albums[albumIdx] ? albums[albumIdx].thumbnailUrl : "";
        const previousHue = albums[albumIdx] ? albums[albumIdx].dominantHue : undefined;

        try {
            const fileName = Date.now() + "_" + file.name;
            const storageRef = ref(storage, "album_covers/" + fileName);
            const snapshot = await uploadBytes(storageRef, file);
            const finalUrl = await getDownloadURL(snapshot.ref);
            const newHue = await window.extractHueFromFile(file);

            albums[albumIdx].coverUrl = finalUrl;
            albums[albumIdx].cover640Url = "";
            albums[albumIdx].thumbnailUrl = "";
            albums[albumIdx].dominantHue = newHue;

            await saveToCloudWithFeedback("handleDiskDrop");
            renderStats();
            runFilter();
        } catch (error) {
            if (albums[albumIdx]) {
                albums[albumIdx].coverUrl = previousCoverUrl;
                albums[albumIdx].cover640Url = previousCover640Url;
                albums[albumIdx].thumbnailUrl = previousThumbnailUrl;
                albums[albumIdx].dominantHue = previousHue;
            }
            const { code, message } = getErrorCodeAndMessage(error);
            console.error(`[Firestore][handleDiskDrop] D&D hiba. code=${code} message=${message}`, error);
            alert("Hiba tortent a feltoltes soran!");
        } finally {
            if (card) card.style.opacity = "1";
        }
    };

    window.saveTodoOnly = async function() {
        const todos = getTodos();
        const artist = document.getElementById("todoArtist").value.trim();
        const album = document.getElementById("todoAlbum").value.trim();

        if (!artist || !album) {
            alert("Eloado es Album megadasa kotelezo!");
            return;
        }

        const todoData = {
            artist,
            album,
            coverUrl: document.getElementById("todoCover").value.trim(),
            length: document.getElementById("todoLength").value.trim(),
            year: document.getElementById("todoYear").value,
            country: (() => {
                const raw = String(document.getElementById("todoCountry")?.value || "").trim();
                if (raw) return /^[A-Za-z]{3}$/.test(raw) ? raw.toUpperCase() : normalizeCountryCode(raw);
                return findCountryForArtist(artist);
            })(),
            genre: document.getElementById("todoGenre").value.trim(),
            recommender: document.getElementById("todoRec").value,
            albumLink: document.getElementById("todoLink").value.trim()
        };

        const todoEditIdx = getTodoEditIdx();
        const isEditingTodo = typeof todoEditIdx === "number" && todoEditIdx >= 0 && !!todos[todoEditIdx];
        const previousTodo = isEditingTodo ? { ...todos[todoEditIdx] } : null;
        if (typeof todoEditIdx === "number" && todoEditIdx >= 0 && todos[todoEditIdx]) {
            todos[todoEditIdx] = { ...todos[todoEditIdx], ...todoData };
        } else {
            todos.push({ ...todoData, isPrioritized: false });
        }

        try {
            await saveToCloudWithFeedback("saveTodoOnly");
        } catch (error) {
            if (isEditingTodo && previousTodo) {
                todos[todoEditIdx] = previousTodo;
            } else {
                todos.pop();
            }
            const { code, message } = getErrorCodeAndMessage(error);
            console.error(`[Firestore][saveTodoOnly] rollback applied. code=${code} message=${message}`, error);
            return;
        }

        setTodoEditIdx(-1);
        document.getElementById("todoArtist").value = "";
        document.getElementById("todoAlbum").value = "";
        document.getElementById("todoCover").value = "";
        document.getElementById("todoYear").value = "";
        document.getElementById("todoCountry").value = "";
        document.getElementById("todoLength").value = "";
        document.getElementById("todoGenre").value = "";
        document.getElementById("todoLink").value = "";
        document.getElementById("todoRec").value = "";

        toggleMod("addTodo");
        renderTodo();
    };

    window.fetchSpotifyForTodo = async function() {
        const spotifyToken = getSpotifyToken();
        if (!spotifyToken) {
            alert("Kerlek, eloszor jelentkezz be a Spotify-ba a konyvtar nezetnel talalhato gombbal!");
            return;
        }

        const linkEl = document.getElementById("todoSpotifyLink");
        const link = linkEl.value.trim();
        if (!link) {
            alert("Kerlek, illessz be egy Spotify linket!");
            return;
        }

        const albumIdMatch = link.match(/\/album\/([a-zA-Z0-9]+)/);
        const albumId = albumIdMatch ? albumIdMatch[1] : null;
        if (!albumId) {
            alert("Ervenytelen Spotify link! Kerlek teljes album linket adj meg.");
            return;
        }

        const btn = document.querySelector('button[onclick="fetchSpotifyForTodo()"]');
        const origText = btn ? btn.innerText : "";
        if (btn) btn.innerText = "Toltes...";

        try {
            const response = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
                headers: { Authorization: `Bearer ${spotifyToken}` }
            });
            if (!response.ok) throw new Error("Hiba az API-val.");
            const data = await response.json();

            document.getElementById("todoArtist").value = data.artists.map((a) => a.name).join(", ");
            document.getElementById("todoAlbum").value = data.name;
            if (data.release_date) document.getElementById("todoYear").value = data.release_date.split("-")[0];
            if (data.images?.length) document.getElementById("todoCover").value = data.images[0].url;
            const todoCountryEl = document.getElementById("todoCountry");
            if (todoCountryEl && !todoCountryEl.value.trim()) {
                const guessedCountry = findCountryForArtist(document.getElementById("todoArtist").value);
                if (guessedCountry) todoCountryEl.value = guessedCountry;
            }
            // compute total album length
            if (data.tracks && data.tracks.items) {
                const totalMs = data.tracks.items.reduce((s, t) => s + (t.duration_ms || 0), 0);
                const formatted = formatMs(totalMs);
                document.getElementById("todoLength").value = formatted;
            }
            if (data.external_urls?.spotify) document.getElementById("todoLink").value = data.external_urls.spotify;

            linkEl.value = "";
        } catch (err) {
            console.error("Spotify adat hiba:", err);
            alert("Hiba tortent az adatok lekeresekor. Lehet, hogy lejart a munkamenet.");
        } finally {
            if (btn) btn.innerText = origText;
        }
    };

    window.editTodo = function(idx) {
        const todos = getTodos();
        const t = todos[idx];
        if (!t) return;

        setTodoEditIdx(idx);

        document.getElementById("todoArtist").value = t.artist || "";
        document.getElementById("todoAlbum").value = t.album || "";
        document.getElementById("todoCover").value = t.coverUrl || "";
        document.getElementById("todoLength").value = t.length || "";
        document.getElementById("todoYear").value = t.year || "";
        document.getElementById("todoCountry").value = t.country || "";
        document.getElementById("todoGenre").value = t.genre || "";
        document.getElementById("todoLink").value = t.albumLink || "";
        document.getElementById("todoRec").value = t.recommender || "";

        toggleMod("addTodo");
    };

    window.captureCard = async function(cardElement, albumName) {
        const originalWidth = cardElement.offsetWidth;
        const originalHeight = cardElement.offsetHeight;
        const uiElements = cardElement.querySelectorAll("[data-html2canvas-ignore], .edit-btn, .btn-snap, .btn-del");
        uiElements.forEach((el) => el.style.setProperty("display", "none", "important"));

        const images = cardElement.querySelectorAll("img");
        images.forEach((img) => {
            img.crossOrigin = "anonymous";
        });

        const options = {
            width: originalWidth,
            height: originalHeight,
            style: { transform: "scale(1)", margin: "0" },
            bgcolor: "#1a1a1a",
            quality: 1.0
        };

        await new Promise((r) => setTimeout(r, 100));

        domtoimage
            .toPng(cardElement, options)
            .then((dataUrl) => {
                const link = document.createElement("a");
                link.download = `${albumName}_review.png`;
                link.href = dataUrl;
                link.click();
                uiElements.forEach((el) => {
                    el.style.display = "";
                });
            })
            .catch((error) => {
                console.error("Hiba:", error);
                uiElements.forEach((el) => {
                    el.style.display = "";
                });
            });
    };

    window.moveToRating = async function(idx) {
        const todos = getTodos();
        const t = todos[idx];
        if (!t) return;

        const spotifyAlbumId = extractSpotifyAlbumId(t.albumLink);
        let pickedTrack = null;
        if (spotifyAlbumId) {
            const spotifyToken = getSpotifyToken();
            if (!spotifyToken) {
                alert("Spotify bejelentkezes szukseges: kattints a Spotify bejelentkezes gombra, majd probald ujra.");
                return;
            }

            try {
                const response = await fetch(`https://api.spotify.com/v1/albums/${spotifyAlbumId}`, {
                    headers: { Authorization: `Bearer ${spotifyToken}` }
                });

                if (response.status === 401) {
                    alert("Spotify munkamenet lejart vagy nincs bejelentkezve. Jelentkezz be ujra a Spotify API-ba.");
                    return;
                }
                if (!response.ok) throw new Error(`Spotify API hiba: ${response.status}`);

                const data = await response.json();
                const tracks = (data?.tracks?.items || [])
                    .map((track) => ({
                        name: track?.name || "",
                        url: track?.external_urls?.spotify || ""
                    }))
                    .filter((track) => track.name && track.url);

                if (!tracks.length) {
                    alert("Ehhez az albumhoz nem talalhato valaszthato dal a Spotify-on.");
                } else {
                    pickedTrack = askTrackChoice(tracks);
                    if (!pickedTrack) {
                        const proceed = confirm("Nem lett kedvenc dal kivalasztva. Folytatod enelkul?");
                        if (!proceed) return;
                    }
                }
            } catch (err) {
                console.error("Spotify dal lista hiba:", err);
                alert("Nem sikerult lekerdezni a Spotify dalokat. Probald ujra kesobb.");
                return;
            }
        }

        document.getElementById("inArtist").value = t.artist || "";
        document.getElementById("inAlbum").value = t.album || "";
        document.getElementById("inCover").value = t.coverUrl || "";
        document.getElementById("inRec").value = t.recommender || "";
        document.getElementById("inYear").value = t.year || "";
        const todoCountry = String(t.country || "").trim();
        document.getElementById("inCountry").value = todoCountry;
        document.getElementById("inGenre").value = t.genre || "";

        ["t_riff", "t_vox", "t_dob", "t_mix", "t_szoveg", "t_vibe"].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = "Meh";
        });

        document.getElementById("inScore").value = "";
        document.getElementById("inReview").value = "";
        document.getElementById("inFavSong").value = pickedTrack?.name || "";
        document.getElementById("inSongUrl").value = pickedTrack?.url || "";
        const dateEl = document.getElementById("inDate");
        if (dateEl) dateEl.value = "";
        document.getElementById("inLength").value = t.length || "";

        setEditIdx(-1);
        const removed = todos.splice(idx, 1)[0];
        try {
            await saveToCloudWithFeedback("moveToRating");
        } catch (error) {
            todos.splice(idx, 0, removed);
            return;
        }

        showPage("library");
        const addMod = document.getElementById("mod-add");
        if (addMod && addMod.style.display !== "block") {
            toggleMod("add");
        }
    };

    window.deleteAlbum = async function(i, type) {
        const albums = getAlbums();
        const todos = getTodos();

        if (!confirm("Kukaba a moslekkal?")) return;

        let removed = null;
        if (type === "lib" || type === "library") removed = albums.splice(i, 1)[0];
        else removed = todos.splice(i, 1)[0];

        try {
            await saveToCloudWithFeedback("deleteAlbum");
            location.reload();
        } catch (err) {
            if (type === "lib" || type === "library") albums.splice(i, 0, removed);
            else todos.splice(i, 0, removed);
            const { code, message } = getErrorCodeAndMessage(err);
            console.error(`[Firestore][deleteAlbum] torlesi hiba. code=${code} message=${message}`, err);
            alert("Hiba tortent a felhoben valo torleskor!");
        }
    };

    window.editAlbum = function(i) {
        const albums = getAlbums();
        const a = albums[i];
        if (!a) return;

        setEditIdx(i);
        document.getElementById("inArtist").value = a.artist;
        document.getElementById("inAlbum").value = a.album;
        document.getElementById("inCover").value = a.coverUrl;
        document.getElementById("inYear").value = a.year;
        document.getElementById("inLength").value = a.length || "";
        const countryInput = document.getElementById("inCountry");
        if (countryInput) countryInput.value = a.country || "";
        document.getElementById("inGenre").value = a.genre;
        document.getElementById("inScore").value = a.myScore;
        document.getElementById("inReview").value = a.review || "";
        document.getElementById("inFavSong").value = a.favSong || "";
        document.getElementById("inSongUrl").value = a.songUrl || "";
        document.getElementById("inDate").value = a.addedDate && a.addedDate !== "Osidokben" ? a.addedDate : "";
        document.getElementById("inRec").value = a.recommender || "";

        const t = a.traits || { riff: "Meh", vox: "Meh", dob: "Meh", mix: "Meh", szoveg: "Meh", vibe: "Meh" };
        document.getElementById("t_riff").value = t.riff;
        document.getElementById("t_vox").value = t.vox;
        document.getElementById("t_dob").value = t.dob;
        document.getElementById("t_mix").value = t.mix;
        document.getElementById("t_szoveg").value = t.szoveg;
        document.getElementById("t_vibe").value = t.vibe;

        toggleMod("add");
        window.scrollTo(0, 0);
        if (typeof showModal === "function") showModal("album");
    };

    window.openLB = function(src) {
        if (!src) return;
        document.getElementById("lb-img").src = src;
        document.getElementById("lightbox").style.display = "flex";
    };
}
