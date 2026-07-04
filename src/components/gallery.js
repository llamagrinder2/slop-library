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
    const rainbowAnalysisCache = new Map();
    const activeCoverObjectUrls = new Set();
    const fallbackCover = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22180%22 height=%22180%22%3E%3Crect fill=%22%23151515%22 width=%22180%22 height=%22180%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22Arial%22 font-size=%2214%22 fill=%22%23555%22%3EKep nem erheto el%3C/text%3E%3C/svg%3E";
    const NEAR_MONO_SAT_THRESHOLD = 0.07;
    const NEAR_MONO_CHROMA_THRESHOLD = 0.04;

    const normalizeHue = (hue) => {
        const h = Number(hue);
        if (!Number.isFinite(h)) return 0;
        const normalized = h % 360;
        return normalized < 0 ? normalized + 360 : normalized;
    };

    const normalizeUnit = (value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return null;
        if (numeric > 1) return Math.max(0, Math.min(1, numeric / 100));
        return Math.max(0, Math.min(1, numeric));
    };

    const extractEmbeddedColorInfo = (album) => {
        const payload =
            (album && typeof album.thumbnailColorData === "object" && album.thumbnailColorData)
            || (album && typeof album.colorData === "object" && album.colorData)
            || null;

        const dominantHue = normalizeHue(
            (payload && (payload.hue ?? payload.dominantHue ?? payload.avgHue))
            ?? album?.dominantHue
            ?? 0
        );

        if (!payload) {
            return {
                hasReliableMonoSignal: false,
                hue: dominantHue,
                isNearMono: false,
                brightness: 0.5
            };
        }

        const satRaw = payload.saturation ?? payload.avgSaturation ?? payload.sat;
        const chromaRaw = payload.chroma ?? payload.avgChroma ?? payload.colorfulness;
        const lumaRaw = payload.lightness ?? payload.avgLightness ?? payload.luma ?? payload.brightness;
        const sat = normalizeUnit(satRaw);
        const chroma = normalizeUnit(chromaRaw);
        const brightness = normalizeUnit(lumaRaw);
        const satForMono = sat ?? chroma;

        if (satForMono === null || brightness === null) {
            return {
                hasReliableMonoSignal: false,
                hue: dominantHue,
                isNearMono: false,
                brightness: 0.5
            };
        }

        const monoBySat = satForMono <= NEAR_MONO_SAT_THRESHOLD;
        const monoByChroma = chroma === null ? monoBySat : chroma <= NEAR_MONO_CHROMA_THRESHOLD;

        return {
            hasReliableMonoSignal: true,
            hue: dominantHue,
            isNearMono: monoBySat && monoByChroma,
            brightness
        };
    };

    const analyzeCoverForRainbowSort = async (src, fallbackHue) => {
        const key = `${src}::${normalizeHue(fallbackHue)}`;
        if (rainbowAnalysisCache.has(key)) return rainbowAnalysisCache.get(key);

        const resultPromise = new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                try {
                    const canvas = document.createElement("canvas");
                    const target = 28;
                    canvas.width = target;
                    canvas.height = target;

                    const ctx = canvas.getContext("2d", { willReadFrequently: true });
                    if (!ctx) {
                        resolve({ isNearMono: false, brightness: 0.5, hue: normalizeHue(fallbackHue) });
                        return;
                    }

                    ctx.drawImage(img, 0, 0, target, target);
                    const data = ctx.getImageData(0, 0, target, target).data;

                    let satSum = 0;
                    let chromaSum = 0;
                    let brightnessSum = 0;
                    let weightedX = 0;
                    let weightedY = 0;
                    let hueWeightSum = 0;
                    let pixelCount = 0;

                    for (let i = 0; i < data.length; i += 4) {
                        const alpha = data[i + 3] / 255;
                        if (alpha < 0.1) continue;

                        const r = data[i] / 255;
                        const g = data[i + 1] / 255;
                        const b = data[i + 2] / 255;
                        const max = Math.max(r, g, b);
                        const min = Math.min(r, g, b);
                        const chroma = max - min;
                        const lightness = (max + min) / 2;
                        const sat = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * lightness - 1));

                        let hue = normalizeHue(fallbackHue);
                        if (chroma > 0) {
                            if (max === r) hue = 60 * (((g - b) / chroma) % 6);
                            else if (max === g) hue = 60 * (((b - r) / chroma) + 2);
                            else hue = 60 * (((r - g) / chroma) + 4);
                            hue = normalizeHue(hue);
                        }

                        const hueWeight = sat * sat;
                        weightedX += Math.cos((hue * Math.PI) / 180) * hueWeight;
                        weightedY += Math.sin((hue * Math.PI) / 180) * hueWeight;
                        hueWeightSum += hueWeight;

                        satSum += sat;
                        chromaSum += chroma;
                        brightnessSum += lightness;
                        pixelCount++;
                    }

                    if (!pixelCount) {
                        resolve({ isNearMono: false, brightness: 0.5, hue: normalizeHue(fallbackHue) });
                        return;
                    }

                    const avgSat = satSum / pixelCount;
                    const avgChroma = chromaSum / pixelCount;
                    const avgBrightness = brightnessSum / pixelCount;
                    const hue = hueWeightSum > 0.0001
                        ? normalizeHue((Math.atan2(weightedY, weightedX) * 180) / Math.PI)
                        : normalizeHue(fallbackHue);

                    resolve({
                        isNearMono: avgSat <= NEAR_MONO_SAT_THRESHOLD && avgChroma <= NEAR_MONO_CHROMA_THRESHOLD,
                        brightness: avgBrightness,
                        hue
                    });
                } catch {
                    resolve({ isNearMono: false, brightness: 0.5, hue: normalizeHue(fallbackHue) });
                }
            };
            img.onerror = () => resolve({ isNearMono: false, brightness: 0.5, hue: normalizeHue(fallbackHue) });
            img.src = src;
        });

        rainbowAnalysisCache.set(key, resultPromise);
        return resultPromise;
    };

    const sortAlbumsForRainbowGrid = async (albumsWithCover) => {
        const enriched = await Promise.all(
            albumsWithCover.map(async (album) => {
                const preferredCover = String(album.thumbnailUrl || album.coverUrl || "").trim();
                const embedded = extractEmbeddedColorInfo(album);

                let rainbowInfo = embedded;
                if (!embedded.hasReliableMonoSignal && preferredCover) {
                    const analyzed = await analyzeCoverForRainbowSort(preferredCover, embedded.hue);
                    rainbowInfo = {
                        ...embedded,
                        ...analyzed,
                        hasReliableMonoSignal: true
                    };
                }

                return {
                    ...album,
                    _rainbowInfo: rainbowInfo
                };
            })
        );

        enriched.sort((a, b) => {
            const left = a._rainbowInfo;
            const right = b._rainbowInfo;
            const leftMono = left && left.isNearMono ? 1 : 0;
            const rightMono = right && right.isNearMono ? 1 : 0;

            if (leftMono !== rightMono) return rightMono - leftMono;
            if (leftMono === 1 && rightMono === 1) {
                return (right.brightness ?? 0.5) - (left.brightness ?? 0.5);
            }
            return (left.hue ?? 0) - (right.hue ?? 0);
        });

        return enriched;
    };

    const formatKb = (bytes) => (bytes / 1024).toFixed(1);

    const revokeActiveCoverObjectUrls = () => {
        activeCoverObjectUrls.forEach((url) => {
            try {
                URL.revokeObjectURL(url);
            } catch {
                // ignore revoke errors
            }
        });
        activeCoverObjectUrls.clear();
    };

    const preloadCover = async (src) => {
        const safeSrc = String(src || "").trim();
        if (!safeSrc) {
            return { resolvedSrc: fallbackCover, bytes: 0 };
        }

        try {
            const response = await fetch(safeSrc, { mode: "cors" });
            if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);

            await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => reject(new Error("Image decode failed"));
                img.src = objectUrl;
            });

            activeCoverObjectUrls.add(objectUrl);
            return { resolvedSrc: objectUrl, bytes: blob.size || 0 };
        } catch {
            return await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve({ resolvedSrc: safeSrc, bytes: 0 });
                img.onerror = () => resolve({ resolvedSrc: fallbackCover, bytes: 0 });
                img.src = safeSrc;
            });
        }
    };

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

    const getFilteredGalleryAlbums = () => {
        const albums = getAlbums();
        if (!albums || albums.length === 0) return [];

        let albumsWithCover = albums.filter((a) => {
            const candidate = (a.thumbnailUrl || a.coverUrl || "").trim();
            return Boolean(candidate);
        });

        if (getIsRainbowMode() && !getIsGalleryDetailsMode()) return albumsWithCover;

        const filterArtist = document.getElementById("galleryFilterArtist")?.value.toLowerCase().trim() || "";
        const filterGenre = document.getElementById("galleryFilterGenre")?.value.toLowerCase().trim() || "";
        const filterRating = document.getElementById("galleryFilterRating")?.value;

        if (!filterArtist && !filterGenre && !filterRating) return albumsWithCover;

        return albumsWithCover.filter((album) => {
            let matches = true;
            if (filterArtist) matches = matches && album.artist.toLowerCase().includes(filterArtist);
            if (filterGenre) matches = matches && (album.genre || "").toLowerCase().includes(filterGenre);
            if (filterRating) matches = matches && parseFloat(album.myScore) === parseFloat(filterRating);
            return matches;
        });
    };

    const getAlbumTimestamp = (album) => {
        const rawDate = String(album?.addedDate || "").trim();
        if (!rawDate || rawDate.toLowerCase() === "osidokben" || rawDate.toLowerCase() === "ősidőkben") return null;
        const ts = Date.parse(rawDate);
        return Number.isFinite(ts) ? ts : null;
    };

    const getExportDateRange = () => {
        const mode = String(document.getElementById("galleryExportDateMode")?.value || "all");
        if (mode !== "range") return { mode: "all", fromTs: null, toTs: null };

        const fromRaw = String(document.getElementById("galleryExportFrom")?.value || "").trim();
        const toRaw = String(document.getElementById("galleryExportTo")?.value || "").trim();
        const fromTs = fromRaw ? Date.parse(`${fromRaw}T00:00:00`) : null;
        const toTs = toRaw ? Date.parse(`${toRaw}T23:59:59`) : null;

        return {
            mode: "range",
            fromTs: Number.isFinite(fromTs) ? fromTs : null,
            toTs: Number.isFinite(toTs) ? toTs : null
        };
    };

    const filterAlbumsForExportDateRange = (albums) => {
        const range = getExportDateRange();
        if (range.mode !== "range") return albums;

        return albums.filter((album) => {
            const ts = getAlbumTimestamp(album);
            if (ts === null) return false;
            if (range.fromTs !== null && ts < range.fromTs) return false;
            if (range.toTs !== null && ts > range.toTs) return false;
            return true;
        });
    };

    const getExportAspectRatio = () => {
        const value = String(document.getElementById("galleryExportAspect")?.value || "16:9");
        const m = value.match(/^\s*(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\s*$/);
        if (!m) return 16 / 9;
        const w = parseFloat(m[1]);
        const h = parseFloat(m[2]);
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return 16 / 9;
        return w / h;
    };

    const getExportRangeLabel = () => {
        const mode = String(document.getElementById("galleryExportDateMode")?.value || "all");
        if (mode !== "range") return "All time";

        const fromRaw = String(document.getElementById("galleryExportFrom")?.value || "").trim();
        const toRaw = String(document.getElementById("galleryExportTo")?.value || "").trim();
        if (!fromRaw && !toRaw) return "All time";
        const fromLabel = fromRaw || "?";
        const toLabel = toRaw || "?";
        return `${fromLabel} - ${toLabel}`;
    };

    const isExportWatermarkEnabled = () => {
        const el = document.getElementById("galleryExportWatermark");
        return !el || Boolean(el.checked);
    };

    const drawWatermarkInEmptyCells = (ctx, options) => {
        const {
            emptyCells,
            thumbSize,
            rangeLabel,
            accentColor
        } = options;

        if (!emptyCells || emptyCells.length === 0) return;

        const sortedByBottom = [...emptyCells].sort((a, b) => b.y - a.y || b.x - a.x);
        const anchor = sortedByBottom[0];

        // Always anchor the watermark panel to the lowest two blocks.
        const panelX = anchor.x;
        const panelY = Math.max(0, anchor.y - thumbSize);
        const panelW = thumbSize;
        const panelH = thumbSize * 2;

        const padX = Math.round(thumbSize * 0.1);
        const textMaxWidth = panelW - padX * 2;
        const slopLetterSpacing = Math.max(2, Math.round(thumbSize * 0.04));

        const measureSpacedText = (text, spacing) => {
            if (!text) return 0;
            let total = 0;
            for (let i = 0; i < text.length; i++) {
                total += ctx.measureText(text[i]).width;
                if (i < text.length - 1) total += spacing;
            }
            return total;
        };

        const drawSpacedText = (text, x, y, spacing) => {
            let cursorX = x;
            for (let i = 0; i < text.length; i++) {
                const ch = text[i];
                ctx.fillText(ch, cursorX, y);
                cursorX += ctx.measureText(ch).width + (i < text.length - 1 ? spacing : 0);
            }
        };

        const fitFont = ({ text, minSize, maxSize, weight = 700, family, spacing = 0 }) => {
            let size = maxSize;
            while (size > minSize) {
                ctx.font = `italic ${weight} ${Math.round(size)}px ${family}`;
                const width = spacing > 0 ? measureSpacedText(text, spacing) : ctx.measureText(text).width;
                if (width <= textMaxWidth) break;
                size -= 1;
            }
            return Math.max(minSize, size);
        };

        const slopText = "Slop";
        const libraryText = "Library";
        const rawDateText = String(rangeLabel || "All time").trim();

        const normalizeDateToken = (value) => {
            const text = String(value || "").trim();
            return text.replace(/(\d{4})[-.](\d{2})[-.](\d{2})/g, "$1.$2.$3");
        };

        const buildDateLines = () => {
            if (!rawDateText || /^all\s*time$/i.test(rawDateText)) return ["All time", ""];

            const rangeParts = rawDateText.split(/\s+-\s+/);
            if (rangeParts.length >= 2) {
                const from = normalizeDateToken(rangeParts[0]);
                const to = normalizeDateToken(rangeParts.slice(1).join(" - "));
                return [`${from}-`, to || "?"];
            }

            return [normalizeDateToken(rawDateText), ""];
        };

        const [dateLine1, dateLine2] = buildDateLines();

        ctx.save();
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = accentColor;

        const slopSize = fitFont({
            text: slopText,
            minSize: thumbSize * 0.17,
            maxSize: thumbSize * 0.34,
            weight: 700,
            family: "gooeyFont, Segoe UI, sans-serif",
            spacing: slopLetterSpacing
        });

        const librarySize = fitFont({
            text: libraryText,
            minSize: thumbSize * 0.14,
            maxSize: thumbSize * 0.26,
            weight: 700,
            family: "Segoe UI, sans-serif"
        });

        const dateSize = fitFont({
            text: dateLine2 ? (ctx.measureText(dateLine1).width >= ctx.measureText(dateLine2).width ? dateLine1 : dateLine2) : dateLine1,
            minSize: thumbSize * 0.09,
            maxSize: thumbSize * 0.18,
            weight: 600,
            family: "Segoe UI, sans-serif"
        });

        const slopY = panelY + Math.round(panelH * 0.14);
        const libraryY = panelY + Math.round(panelH * 0.4);
        const dateY = panelY + Math.round(panelH * 0.62);
        const dateLineGap = Math.round(dateSize * 1.2);

        ctx.font = `italic 700 ${Math.round(slopSize)}px gooeyFont, Segoe UI, sans-serif`;
        drawSpacedText(slopText, panelX + padX, slopY, slopLetterSpacing);

        ctx.font = `italic 700 ${Math.round(librarySize)}px Segoe UI, sans-serif`;
        ctx.fillText(libraryText, panelX + padX, libraryY);

        ctx.font = `italic 600 ${Math.round(dateSize)}px Segoe UI, sans-serif`;
        ctx.fillText(dateLine1, panelX + padX, dateY);
        if (dateLine2) {
            ctx.fillText(dateLine2, panelX + padX, dateY + dateLineGap);
        }

        ctx.restore();
    };

    window.toggleGalleryExportDateInputs = function() {
        const mode = String(document.getElementById("galleryExportDateMode")?.value || "all");
        const isRange = mode === "range";
        const fromEl = document.getElementById("galleryExportFrom");
        const toEl = document.getElementById("galleryExportTo");

        if (fromEl) {
            fromEl.disabled = !isRange;
            fromEl.style.opacity = isRange ? "1" : "0.6";
        }
        if (toEl) {
            toEl.disabled = !isRange;
            toEl.style.opacity = isRange ? "1" : "0.6";
        }
    };

    window.toggleGalleryExportDateInputs();

    window.renderGallery = async function() {
        const container = document.getElementById("galleryContainer");
        if (!container) return;
        updateGalleryModeButtons();
        revokeActiveCoverObjectUrls();

        const albums = getAlbums();
        if (!albums || albums.length === 0) {
            container.innerHTML = "<div class=\"gallery-empty\">Nincsenek albumok az adatbazisban</div>";
            return;
        }

        let albumsWithCover = getFilteredGalleryAlbums();

        if (albumsWithCover.length === 0) {
            container.innerHTML = "<div class=\"gallery-empty\">Nincs olyan album, amely megfelel a szuro felteteleknek</div>";
            return;
        }

        const requestId = ++renderRequestId;
        let loadedCount = 0;
        let loadedBytes = 0;
        const totalCount = albumsWithCover.length;

        const updateLoadingLabel = () => {
            container.innerHTML = `<div class="gallery-loading">Borítók betöltése... ${loadedCount}/${totalCount} (${formatKb(loadedBytes)} kB)</div>`;
        };

        updateLoadingLabel();

        if (getIsRainbowMode() && !getIsGalleryDetailsMode()) {
            albumsWithCover = await sortAlbumsForRainbowGrid(albumsWithCover);
            if (requestId !== renderRequestId) return;
        }

        const preloadedAlbums = await Promise.all(
            albumsWithCover.map(async (album) => {
                const preferredCover = (album.thumbnailUrl || album.coverUrl || "").trim();
                const loaded = await preloadCover(preferredCover);

                loadedCount += 1;
                loadedBytes += loaded.bytes;
                if (requestId === renderRequestId) updateLoadingLabel();

                return {
                ...album,
                _displayCover: preferredCover,
                _resolvedCover: loaded.resolvedSrc
                };
            })
        );

        if (requestId !== renderRequestId) return;

        container.innerHTML = preloadedAlbums
            .map((album) => {
                const isExternal = album._displayCover && !album._displayCover.includes("firebasestorage");
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
        let albumsForExport = getFilteredGalleryAlbums();
        albumsForExport = filterAlbumsForExportDateRange(albumsForExport);
        if (getIsRainbowMode() && !getIsGalleryDetailsMode()) {
            albumsForExport = await sortAlbumsForRainbowGrid(albumsForExport);
        }
        const imageSources = albumsForExport
            .map((album) => String(album.thumbnailUrl || album.coverUrl || "").trim())
            .filter(Boolean);

        if (!imageSources.length) return alert("Nincs menthető kép a kiválasztott export feltételekkel.");

        const btn = document.querySelector('button[onclick="downloadGalleryAsImage()"]');
        const origText = btn.innerText;
        btn.innerText = "Kep generalasa...";
        btn.disabled = true;

        const thumbSize = 300;
        const count = imageSources.length;
        const targetAspect = getExportAspectRatio();

        // Target aspect ratio aware column/row fit.
        let cols = Math.max(1, Math.round(Math.sqrt(count * targetAspect)));
        let rows = Math.ceil(count / cols);
        
        // Ha túlbecsültük és maradt egy teljes üres oszlopunk, korrigáljuk
        if ((rows * (cols - 1)) >= count) {
            cols--;
        }

        const canvas = document.createElement("canvas");
        canvas.width = cols * thumbSize;
        canvas.height = rows * thumbSize;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#111111";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        try {
            const loadImageForCollage = (imgSrc) =>
                new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = "Anonymous";
                    img.onload = () => resolve({ ok: true, img });
                    img.onerror = () => resolve({ ok: false, img: null });
                    img.src = imgSrc;
                });

            const preloadImagesParallel = async (sources, limit, onProgress) => {
                const total = sources.length;
                const results = new Array(total);
                let nextIndex = 0;
                let done = 0;

                const worker = async () => {
                    while (true) {
                        const idx = nextIndex;
                        nextIndex += 1;
                        if (idx >= total) return;

                        results[idx] = await loadImageForCollage(sources[idx]);
                        done += 1;
                        if (typeof onProgress === "function") onProgress(done, total);
                    }
                };

                const workerCount = Math.max(1, Math.min(limit, total));
                await Promise.all(Array.from({ length: workerCount }, () => worker()));
                return results;
            };

            btn.innerText = `Elotoltes: 0 / ${count}`;
            const preloadedImages = await preloadImagesParallel(imageSources, 8, (done, total) => {
                btn.innerText = `Elotoltes: ${done} / ${total}`;
            });

            // --- RAJZOLÁS OSZLOPONKÉNT FENTRŐL LEFELÉ ---
            for (let i = 0; i < count; i++) {
                // A matematikai trükk: a maradékos osztást megcseréljük,
                // így először a sorokat töltjük fel lefelé haladva, majd ugrunk a következő oszlopra.
                const colIndex = Math.floor(i / rows);
                const rowIndex = i % rows;

                const x = colIndex * thumbSize;
                const y = rowIndex * thumbSize;

                const loaded = preloadedImages[i];
                if (loaded && loaded.ok && loaded.img) {
                    ctx.drawImage(loaded.img, x, y, thumbSize, thumbSize);
                } else {
                    ctx.fillStyle = "#222";
                    ctx.fillRect(x, y, thumbSize, thumbSize);
                }

                if (i === count - 1 || (i + 1) % 12 === 0) {
                    btn.innerText = `Rajzolas: ${i + 1} / ${count}`;
                }
            }

            if (isExportWatermarkEnabled()) {
                const totalSlots = rows * cols;
                const emptyCells = [];
                for (let i = count; i < totalSlots; i++) {
                    const colIndex = Math.floor(i / rows);
                    const rowIndex = i % rows;
                    emptyCells.push({ x: colIndex * thumbSize, y: rowIndex * thumbSize });
                }

                drawWatermarkInEmptyCells(ctx, {
                    emptyCells,
                    thumbSize,
                    rangeLabel: getExportRangeLabel(),
                    accentColor: "#ffcc00"
                });
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
