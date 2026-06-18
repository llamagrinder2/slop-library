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
    window.saveAlbum = async function() {
        const albums = getAlbums();
        const editIdx = getEditIdx();

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
        const nextAlbum = {
            id: editIdx > -1 ? albums[editIdx].id : maxId + 1,
            artist: document.getElementById("inArtist").value.trim(),
            album: document.getElementById("inAlbum").value.trim(),
            coverUrl: finalCoverUrl,
            year: document.getElementById("inYear").value,
            genre: document.getElementById("inGenre").value.trim(),
            recommender: document.getElementById("inRec").value,
            myScore: parseFloat(document.getElementById("inScore").value) || 0,
            review: document.getElementById("inReview").value.trim(),
            favSong: document.getElementById("inFavSong").value.trim(),
            songUrl: document.getElementById("inSongUrl").value.trim(),
            traits,
            addedDate: dateInput || "Osidokben"
        };

        if (editIdx > -1) {
            albums[editIdx] = nextAlbum;
            setEditIdx(-1);
        } else {
            albums.push(nextAlbum);
        }

        try {
            await saveToFirebase();
            renderStats();
            runFilter();
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

        try {
            const fileName = Date.now() + "_" + file.name;
            const storageRef = ref(storage, "album_covers/" + fileName);
            const snapshot = await uploadBytes(storageRef, file);
            const finalUrl = await getDownloadURL(snapshot.ref);
            const newHue = await window.extractHueFromFile(file);

            albums[albumIdx].coverUrl = finalUrl;
            albums[albumIdx].dominantHue = newHue;

            await saveToFirebase();
            renderStats();
            runFilter();
        } catch (error) {
            console.error("D&D hiba:", error);
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
            year: document.getElementById("todoYear").value,
            genre: document.getElementById("todoGenre").value.trim(),
            recommender: document.getElementById("todoRec").value,
            albumLink: document.getElementById("todoLink").value.trim()
        };

        const todoEditIdx = getTodoEditIdx();
        if (typeof todoEditIdx === "number" && todoEditIdx >= 0 && todos[todoEditIdx]) {
            todos[todoEditIdx] = { ...todos[todoEditIdx], ...todoData };
        } else {
            todos.push(todoData);
        }

        await saveToFirebase();

        setTodoEditIdx(-1);
        document.getElementById("todoArtist").value = "";
        document.getElementById("todoAlbum").value = "";
        document.getElementById("todoCover").value = "";
        document.getElementById("todoYear").value = "";
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
        document.getElementById("todoYear").value = t.year || "";
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

        document.getElementById("inArtist").value = t.artist || "";
        document.getElementById("inAlbum").value = t.album || "";
        document.getElementById("inCover").value = t.coverUrl || "";
        document.getElementById("inRec").value = t.recommender || "";
        document.getElementById("inYear").value = t.year || "";
        document.getElementById("inGenre").value = t.genre || "";

        ["t_riff", "t_vox", "t_dob", "t_mix", "t_szoveg", "t_vibe"].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = "Meh";
        });

        document.getElementById("inScore").value = "";
        document.getElementById("inReview").value = "";
        document.getElementById("inFavSong").value = "";
        document.getElementById("inSongUrl").value = "";
        const dateEl = document.getElementById("inDate");
        if (dateEl) dateEl.value = "";

        setEditIdx(-1);
        todos.splice(idx, 1);
        await saveToFirebase();

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

        if (type === "lib" || type === "library") albums.splice(i, 1);
        else todos.splice(i, 1);

        try {
            await saveToFirebase();
            location.reload();
        } catch (err) {
            console.error("Firebase torlesi hiba:", err);
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
