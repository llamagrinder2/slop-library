import { normalizeCountryCode } from "../core/countries.js";
import { loadImageToResizedCanvasFromUrl, canvasToJpegBlob } from "../features/imageProcessing.js";

export function registerSettingsHandlers({
    getAlbums,
    getTodos,
    getSlopGenres,
    getCatDeath,
    getCatBlack,
    getCatCore,
    getCatHeavy,
    getCatEtc,
    getCatNonMetal,
    saveToFirebase,
    storage,
    ref,
    uploadBytes,
    getDownloadURL
}) {
    const sanitizePathSegment = (value) =>
        String(value || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 64) || "album";

    const cloneValue = (value) => {
        if (value === undefined) return undefined;
        if (typeof structuredClone === "function") {
            try {
                return structuredClone(value);
            } catch {
                // fall through to JSON clone
            }
        }
        try {
            return JSON.parse(JSON.stringify(value));
        } catch {
            return value;
        }
    };

    const getAlbumColorData = (album) => {
        if (album && album.colorData !== undefined) return cloneValue(album.colorData);
        if (album && album.dominantHue !== undefined) return cloneValue(album.dominantHue);
        return null;
    };

    const uploadProcessedBlob = async (album, blob, folder) => {
        const idPart = album && album.id !== undefined ? String(album.id) : `${Date.now()}`;
        const artistPart = sanitizePathSegment(album?.artist || "artist");
        const albumPart = sanitizePathSegment(album?.album || "release");
        const path = `${folder}/${artistPart}_${albumPart}_${idPart}.jpg`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
        return getDownloadURL(storageRef);
    };

    window.renderSettings = function() {
        const albums = getAlbums();
        const slopG = getSlopGenres();
        const catDeath = getCatDeath();
        const catBlack = getCatBlack();
        const catCore = getCatCore();
        const catHeavy = getCatHeavy();
        const catEtc = getCatEtc();
        const catNonMetal = getCatNonMetal();

        const gs = new Set();
        albums.forEach((a) => a.genre.split(",").forEach((g) => gs.add(g.trim())));

        const container = document.getElementById("setG");
        if (!container) return;

        container.innerHTML = [...gs]
            .sort()
            .map((g) => {
                const lg = g.toLowerCase();
                const getBtnStyle = (list, color) => {
                    const isActive = list.includes(lg);
                    return `background:${isActive ? color : "#333"}; color:${isActive ? "#000" : "#ccc"}; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; font-size:10px; font-weight:bold;`;
                };

                return `
                <div class="settings-row" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; padding:5px; border-bottom:1px solid #333;">
                    <span style="flex:1; font-size:13px;">${g}</span>
                    <div style="display:flex; gap:4px;">
                        <button onclick="tCat('${lg}', 'death')" style="${getBtnStyle(catDeath, "#ff4444")}">DEATH</button>
                        <button onclick="tCat('${lg}', 'black')" style="${getBtnStyle(catBlack, "#9944ff")}">BLACK</button>
                        <button onclick="tCat('${lg}', 'core')" style="${getBtnStyle(catCore, "#44ff44")}">CORE</button>
                        <button onclick="tCat('${lg}', 'heavy')" style="${getBtnStyle(catHeavy, "#4444ff")}">HEAVY/Etc.</button>
                        <button onclick="tCat('${lg}', 'etc')" style="${getBtnStyle(catEtc, "#888888")}">ETC</button>
                        <button onclick="tCat('${lg}', 'nonmetal')" style="${getBtnStyle(catNonMetal, "#ff00ff")}">NON-METAL</button>
                        <button onclick="tSlop('${lg}')" style="background:${slopG.includes(lg) ? "#ffcc00" : "#222"}; color:#000; border:none; padding:5px 8px; border-radius:4px; font-size:10px; font-weight:bold; margin-left:10px;">SLOP</button>
                    </div>
                </div>`;
            })
            .join("");
    };

    window.runCoverResize640 = async function() {
        const albums = getAlbums();
        const btn = document.getElementById("btnResizeCovers640");
        if (!btn) return;

        const originalText = btn.innerText;
        btn.disabled = true;

        let processed = 0;
        let resized = 0;
        let skipped = 0;
        let failed = 0;

        try {
            for (const album of albums) {
                if (!album || !album.coverUrl) {
                    skipped++;
                    continue;
                }

                processed++;
                btn.innerText = `Feldolgozas: ${processed}/${albums.length}`;

                try {
                    const resizedCanvasData = await loadImageToResizedCanvasFromUrl(album.coverUrl, { maxSide: 640 });
                    if (!resizedCanvasData.changed) {
                        skipped++;
                        console.log("[Resize640] Skipped (already <= 640):", album.artist, album.album);
                        continue;
                    }

                    const blob = await canvasToJpegBlob(resizedCanvasData.canvas, 0.9);
                    const newCoverUrl = await uploadProcessedBlob(album, blob, "covers_640");
                    album.cover640Url = newCoverUrl;
                    resized++;

                    console.log("[Resize640] Updated:", album.artist, album.album, `${resizedCanvasData.originalWidth}x${resizedCanvasData.originalHeight} -> ${resizedCanvasData.width}x${resizedCanvasData.height}`);
                } catch (err) {
                    failed++;
                    console.error("[Resize640] Failed for album:", album, err);
                }
            }

            if (resized > 0) {
                btn.innerText = "Mentes a felhobe...";
                await saveToFirebase();
            }

            btn.innerText = `Kesz! Frissitve: ${resized}, kihagyva: ${skipped}, hiba: ${failed}`;
        } catch (err) {
            console.error("[Resize640] Batch failed:", err);
            btn.innerText = "Hiba a batch kozben";
        } finally {
            setTimeout(() => {
                btn.innerText = originalText;
                btn.disabled = false;
            }, 4500);
        }
    };

    window.runGenerateThumbnails = async function() {
        const albums = getAlbums();
        const btn = document.getElementById("btnGenerateThumbnails");
        if (!btn) return;

        const originalText = btn.innerText;
        btn.disabled = true;

        let processed = 0;
        let generated = 0;
        let skipped = 0;
        let failed = 0;

        try {
            for (const album of albums) {
                if (!album || !album.coverUrl) {
                    skipped++;
                    continue;
                }

                processed++;
                btn.innerText = `Feldolgozas: ${processed}/${albums.length}`;

                try {
                    const thumbCanvasData = await loadImageToResizedCanvasFromUrl(album.coverUrl, { maxSide: 150 });
                    const blob = await canvasToJpegBlob(thumbCanvasData.canvas, 0.82);
                    const thumbnailUrl = await uploadProcessedBlob(album, blob, "thumbnails");

                    album.thumbnailUrl = thumbnailUrl;
                    album.thumbnailColorData = getAlbumColorData(album);

                    generated++;
                    console.log("[Thumbnails] Generated:", album.artist, album.album, `${thumbCanvasData.width}x${thumbCanvasData.height}`);
                } catch (err) {
                    failed++;
                    console.error("[Thumbnails] Failed for album:", album, err);
                }
            }

            if (generated > 0) {
                btn.innerText = "Mentes a felhobe...";
                await saveToFirebase();
            }

            btn.innerText = `Kesz! Uj thumb: ${generated}, kihagyva: ${skipped}, hiba: ${failed}`;
        } catch (err) {
            console.error("[Thumbnails] Batch failed:", err);
            btn.innerText = "Hiba a batch kozben";
        } finally {
            setTimeout(() => {
                btn.innerText = originalText;
                btn.disabled = false;
            }, 4500);
        }
    };

    window.runColorHarvester = async function() {
        const albums = getAlbums();
        const btn = document.getElementById("btnColorHarvester");
        if (!btn) return;

        const toProcess = albums.filter((a) => a.coverUrl && a.coverUrl.includes("firebasestorage") && a.dominantHue === undefined);
        const total = toProcess.length;

        if (total === 0) {
            btn.innerText = "Minden kep fel van dolgozva!";
            setTimeout(() => {
                btn.innerText = "SZINEK FELDOLGOZASA";
            }, 3000);
            return;
        }

        btn.disabled = true;
        btn.innerText = `Elokeszites... (0 / ${total})`;
        let updatedCount = 0;
        let currentCount = 0;

        const rgbToHue = (r, g, b) => {
            r /= 255;
            g /= 255;
            b /= 255;
            let max = Math.max(r, g, b);
            let min = Math.min(r, g, b);
            let h = 0;
            if (max !== min) {
                const d = max - min;
                switch (max) {
                    case r:
                        h = (g - b) / d + (g < b ? 6 : 0);
                        break;
                    case g:
                        h = (b - r) / d + 2;
                        break;
                    case b:
                        h = (r - g) / d + 4;
                        break;
                    default:
                        break;
                }
                h /= 6;
            }
            return Math.round(h * 360);
        };

        const getHueFromUrl = (url) =>
            new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0);
                    try {
                        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                        let r = 0;
                        let g = 0;
                        let b = 0;
                        let c = 0;
                        for (let i = 0; i < data.length; i += 4) {
                            r += data[i];
                            g += data[i + 1];
                            b += data[i + 2];
                            c++;
                        }
                        resolve(rgbToHue(Math.floor(r / c), Math.floor(g / c), Math.floor(b / c)));
                    } catch (e) {
                        resolve(null);
                    }
                };
                img.onerror = () => resolve(null);
                img.src = url;
            });

        for (let i = 0; i < albums.length; i++) {
            const a = albums[i];
            if (a.coverUrl && a.coverUrl.includes("firebasestorage") && a.dominantHue === undefined) {
                currentCount++;
                btn.innerText = `Feldolgozas... ${currentCount} / ${total}`;
                const hue = await getHueFromUrl(a.coverUrl);
                if (hue !== null) {
                    a.dominantHue = hue;
                    updatedCount++;
                }
            }
        }

        if (updatedCount > 0) {
            btn.innerText = "Mentes az adatbazisba...";
            await saveToFirebase();
            btn.innerText = `Kesz! (${updatedCount} album frissitve)`;
        } else {
            btn.innerText = "Nem sikerult uj szint kinyerni.";
        }

        setTimeout(() => {
            btn.innerText = "SZINEK FELDOLGOZASA";
            btn.disabled = false;
        }, 4000);
    };

    window.runCountryMatcher = async function() {
        const albums = getAlbums();
        const todos = typeof getTodos === "function" ? getTodos() : [];
        const btn = document.getElementById("btnCountryMatcher");
        if (!btn) return;

        btn.disabled = true;
        const originalText = btn.innerText;
        btn.innerText = "EGYEZTETÉS...";

        const artistCountryCounts = new Map();
        const artistKey = (name) => String(name || "").trim().toLowerCase();

        const collectKnownCountries = (items) => {
            items.forEach((item) => {
                const key = artistKey(item.artist);
                if (!key) return;
                const rawCountry = String(item.country || "").trim();
                if (!rawCountry) return;
                const code = normalizeCountryCode(rawCountry);
                if (!code) return;

                if (!artistCountryCounts.has(key)) artistCountryCounts.set(key, new Map());
                const countryMap = artistCountryCounts.get(key);
                countryMap.set(code, (countryMap.get(code) || 0) + 1);
            });
        };

        collectKnownCountries(albums);
        collectKnownCountries(todos);

        const pickBestCountry = (name) => {
            const key = artistKey(name);
            const countryMap = artistCountryCounts.get(key);
            if (!countryMap || countryMap.size === 0) return "";

            let bestCode = "";
            let bestCount = -1;
            countryMap.forEach((count, code) => {
                if (count > bestCount) {
                    bestCode = code;
                    bestCount = count;
                }
            });
            return bestCode;
        };

        let updatedAlbums = 0;
        let updatedTodos = 0;

        albums.forEach((item) => {
            const hasCountry = String(item.country || "").trim();
            if (hasCountry) return;
            const code = pickBestCountry(item.artist);
            if (!code) return;
            item.country = code;
            updatedAlbums++;
        });

        todos.forEach((item) => {
            const hasCountry = String(item.country || "").trim();
            if (hasCountry) return;
            const code = pickBestCountry(item.artist);
            if (!code) return;
            item.country = code;
            updatedTodos++;
        });

        try {
            if (updatedAlbums + updatedTodos > 0) {
                await saveToFirebase();
                if (typeof window.runFilter === "function") window.runFilter();
                if (typeof window.renderTodo === "function") window.renderTodo();
                if (typeof window.renderTodoListView === "function") window.renderTodoListView();
            }

            btn.innerText = `KÉSZ (${updatedAlbums} könyvtár, ${updatedTodos} todo)`;
        } catch (err) {
            console.error("Ország egyeztetés hiba:", err);
            btn.innerText = "HIBA EGYEZTETÉSKOR";
        }

        setTimeout(() => {
            btn.innerText = originalText;
            btn.disabled = false;
        }, 3500);
    };

    window.tSlop = function(g) {
        const slopG = getSlopGenres();
        const idx = slopG.indexOf(g);
        if (idx === -1) slopG.push(g);
        else slopG.splice(idx, 1);

        window.saveToFirebase();
        window.renderSettings();
    };

    window.tCat = function(g, cat) {
        const catArrays = {
            death: getCatDeath(),
            black: getCatBlack(),
            core: getCatCore(),
            heavy: getCatHeavy(),
            etc: getCatEtc(),
            nonmetal: getCatNonMetal()
        };

        Object.values(catArrays).forEach((arr) => {
            const i = arr.indexOf(g);
            if (i !== -1) arr.splice(i, 1);
        });

        if (catArrays[cat]) catArrays[cat].push(g);
        if (window.saveToFirebase) window.saveToFirebase();
        if (window.renderSettings) window.renderSettings();
    };
}
