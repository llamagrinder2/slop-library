export function registerGalleryComponents({
    getAlbums,
    getIsRainbowMode,
    setIsRainbowMode,
    getIsGalleryDetailsMode,
    setIsGalleryDetailsMode,
    getCurrentPage,
    setCurrentPage,
    runFilter,
    showPage
}) {
    let renderRequestId = 0;
    const fallbackCover = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22180%22 height=%22180%22%3E%3Crect fill=%22%23151515%22 width=%22180%22 height=%22180%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22Arial%22 font-size=%2214%22 fill=%22%23555%22%3EKep nem erheto el%3C/text%3E%3C/svg%3E";

    const preloadCover = (src) =>
        new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(src);
            img.onerror = () => resolve(fallbackCover);
            img.src = src;
        });

    const updateGalleryModeButtons = () => {
        const detailsBtn = document.getElementById("btnGalleryDetails");
        const rainbowBtn = document.getElementById("btnRainbow");
        const isDetailsMode = getIsGalleryDetailsMode();

        if (detailsBtn) {
            detailsBtn.innerText = isDetailsMode ? "RÉSZLETEK: BE" : "RÉSZLETEK";
            detailsBtn.style.background = isDetailsMode ? "var(--accent)" : "";
            detailsBtn.style.color = isDetailsMode ? "#000" : "";
        }

        if (rainbowBtn) {
            rainbowBtn.disabled = isDetailsMode;
            rainbowBtn.style.opacity = isDetailsMode ? "0.4" : "1";
            if (isDetailsMode) rainbowBtn.title = "Részletek módban a szivárvány rendezés nem elérhető";
            else rainbowBtn.title = "";
        }
    };

    window.toggleGalleryDetailsMode = function() {
        const next = !getIsGalleryDetailsMode();
        setIsGalleryDetailsMode(next);

        if (next && getIsRainbowMode()) {
            setIsRainbowMode(false);
        }

        updateGalleryModeButtons();
        window.renderGallery();
    };

    window.toggleRainbowMode = function() {
        if (getIsGalleryDetailsMode()) return;

        const next = !getIsRainbowMode();
        setIsRainbowMode(next);

        const btn = document.getElementById("btnRainbow");
        if (!btn) return;

        if (next) {
            btn.style.background = "linear-gradient(to right, #ff000033, #0000ff33)";
            btn.innerText = "Normal Racs";
            const a = document.getElementById("galleryFilterArtist");
            const g = document.getElementById("galleryFilterGenre");
            const r = document.getElementById("galleryFilterRating");
            if (a) a.value = "";
            if (g) g.value = "";
            if (r) r.value = "";
        } else {
            btn.style.background = "#111";
            btn.innerText = "Szivarvany Racs";
        }

        window.renderGallery();
    };

    window.renderGallery = async function() {
        const container = document.getElementById("galleryContainer");
        if (!container) return;
        updateGalleryModeButtons();

        const albums = getAlbums();
        if (!albums || albums.length === 0) {
            container.innerHTML = "<div class=\"gallery-empty\">Nincsenek albumok az adatbazisban</div>";
            return;
        }

        let albumsWithCover = albums.filter((a) => a.coverUrl && a.coverUrl.trim());

        if (getIsRainbowMode() && !getIsGalleryDetailsMode()) {
            albumsWithCover = albumsWithCover.filter((a) => a.dominantHue !== undefined);
            albumsWithCover.sort((a, b) => a.dominantHue - b.dominantHue);
        } else {
            const filterArtist = document.getElementById("galleryFilterArtist")?.value.toLowerCase().trim() || "";
            const filterGenre = document.getElementById("galleryFilterGenre")?.value.toLowerCase().trim() || "";
            const filterRating = document.getElementById("galleryFilterRating")?.value;

            if (filterArtist || filterGenre || filterRating) {
                albumsWithCover = albumsWithCover.filter((album) => {
                    let matches = true;
                    if (filterArtist) matches = matches && album.artist.toLowerCase().includes(filterArtist);
                    if (filterGenre) matches = matches && (album.genre || "").toLowerCase().includes(filterGenre);
                    if (filterRating) matches = matches && parseFloat(album.myScore) === parseFloat(filterRating);
                    return matches;
                });
            }
        }

        if (albumsWithCover.length === 0) {
            container.innerHTML = "<div class=\"gallery-empty\">Nincs olyan album, amely megfelel a szuro felteteleknek</div>";
            return;
        }

        const requestId = ++renderRequestId;
        container.innerHTML = "<div class=\"gallery-loading\">Borítók betöltése...</div>";

        const preloadedAlbums = await Promise.all(
            albumsWithCover.map(async (album) => ({
                ...album,
                _resolvedCover: await preloadCover(album.coverUrl)
            }))
        );

        if (requestId !== renderRequestId) return;

        container.innerHTML = preloadedAlbums
            .map((album) => {
                const isExternal = album.coverUrl && !album.coverUrl.includes("firebasestorage");
                const detailsMode = getIsGalleryDetailsMode();
                const safeScore = Number.isFinite(parseFloat(album.myScore)) ? parseFloat(album.myScore) : 0;
                const scoreBg = `hsl(${(Math.max(1, safeScore) - 1) * 13},70%,40%)`;

                return `
                <div class="gallery-item ${detailsMode ? "gallery-detailed" : ""}" onclick="showAlbumDetails(${album.id})">
                    ${isExternal ? "<div class=\"gallery-external-link-indicator\" title=\"Kulso hivatkozas\">🔗</div>" : ""}
                    <img src="${album._resolvedCover}" alt="${album.album}">
                    ${detailsMode ? `
                    <div class="gallery-details">
                        <div class="gallery-details-artist">${album.artist || "-"}</div>
                        <div class="gallery-details-album">${album.album || "-"}</div>
                        <div class="gallery-details-score" style="background:${scoreBg};">${safeScore > 0 ? safeScore.toFixed(1) : "-"}</div>
                    </div>` : ""}
                    <div class="album-overlay" style="${detailsMode ? "display:none;" : ""}">
                        <div class="album-overlay-title">${album.album}</div>
                        <div class="album-overlay-artist">${album.artist}</div>
                    </div>
                </div>`;
            })
            .join("");
    };

    window.downloadGalleryAsImage = async function() {
        const container = document.getElementById("galleryContainer");
        const images = container?.querySelectorAll("img") || [];
        if (!images.length) return alert("Nincs mit menteni!");

        const btn = document.querySelector('button[onclick="downloadGalleryAsImage()"]');
        const origText = btn.innerText;
        btn.innerText = "Kep generalasa...";
        btn.disabled = true;

        const thumbSize = 300;
        const cols = 5;
        const rows = Math.ceil(images.length / cols);

        const canvas = document.createElement("canvas");
        canvas.width = cols * thumbSize;
        canvas.height = rows * thumbSize;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#111111";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        try {
            const loadAndDraw = (imgSrc, x, y) =>
                new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = "Anonymous";
                    img.onload = () => {
                        ctx.drawImage(img, x, y, thumbSize, thumbSize);
                        resolve();
                    };
                    img.onerror = () => {
                        ctx.fillStyle = "#222";
                        ctx.fillRect(x, y, thumbSize, thumbSize);
                        resolve();
                    };
                    img.src = imgSrc;
                });

            for (let i = 0; i < images.length; i++) {
                const x = (i % cols) * thumbSize;
                const y = Math.floor(i / cols) * thumbSize;
                await loadAndDraw(images[i].src, x, y);
                btn.innerText = `Rajzolas: ${i + 1} / ${images.length}`;
            }

            const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
            const link = document.createElement("a");
            link.download = `album_gyujtemeny_${Date.now()}.jpg`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error("Hiba a kep generalasakor:", err);
            alert("Hiba tortent a kep osszeallitasa kozben.");
        } finally {
            btn.innerText = origText;
            btn.disabled = false;
        }
    };

    window.showAlbumDetails = function(albumId) {
        const album = getAlbums().find((a) => a.id === albumId);
        if (!album) return;

        const searchInput = document.getElementById("gSearch");
        if (searchInput) searchInput.value = album.album;

        showPage("library");
        setTimeout(() => {
            setCurrentPage(1);
            runFilter();
        }, 0);
    };
}
