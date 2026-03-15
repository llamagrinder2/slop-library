export function registerStatsHandlers({
    getAlbums,
    getSlopGenres,
    getRareLimit,
    getCharts,
    getCatDeath,
    getCatBlack,
    getCatCore,
    getCatHeavy,
    getCatEtc,
    getCatNonMetal,
    getCurrentGenreLevel,
    setCurrentGenreLevel,
    getTopSortAsc,
    isMissing,
    recommenders
}) {
    window.renderStats = function() {
        const albums = getAlbums();
        const slopG = getSlopGenres();
        const rareLimit = getRareLimit();
        const charts = getCharts();
        const catDeath = getCatDeath();
        const catBlack = getCatBlack();
        const catCore = getCatCore();
        const catHeavy = getCatHeavy();
        const catEtc = getCatEtc();
        const catNonMetal = getCatNonMetal();

        if (!albums.length) return;

        const years = {};
        const genres = {};
        const gScores = {};
        const yScores = {};
        let sCount = 0;
        let totalScore = 0;
        let totalWords = 0;
        const uniqueArtists = new Set();
        const uniqueGenres = new Set();

        let validAlbumCount = 0;
        albums.forEach((a) => {
            const s = parseFloat(a.myScore) || 0;

            if (s > 0) {
                totalScore += s;
                validAlbumCount++;
            }

            uniqueArtists.add(a.artist);
            if (a.review) totalWords += a.review.trim().split(/\s+/).filter((w) => w.length > 0).length;

            if (a.year) {
                years[a.year] = (years[a.year] || 0) + 1;
                if (!yScores[a.year]) yScores[a.year] = [];
                if (s > 0) yScores[a.year].push(s);
            }

            const tags = String(a.genre).split(",").map((t) => t.trim());
            let isS = false;
            tags.forEach((t) => {
                if (!t) return;
                uniqueGenres.add(t);
                genres[t] = (genres[t] || 0) + 1;
                if (!gScores[t]) gScores[t] = [];
                if (s > 0) gScores[t].push(s);
                if (slopG.includes(t.toLowerCase())) isS = true;
            });
            if (isS) sCount++;
        });

        let chartLabels = [];
        let chartData = [];
        const currentGenreLevel = getCurrentGenreLevel();

        if (currentGenreLevel === "main") {
            const mainCats = { Death: 0, Black: 0, Core: 0, Heavy: 0, ETC: 0, "Non-Metal": 0, Besorolatlan: 0 };
            Object.entries(genres).forEach(([genreName, count]) => {
                const lg = genreName.toLowerCase();
                if (catDeath.includes(lg)) mainCats.Death += count;
                else if (catBlack.includes(lg)) mainCats.Black += count;
                else if (catCore.includes(lg)) mainCats.Core += count;
                else if (catHeavy.includes(lg)) mainCats.Heavy += count;
                else if (catEtc.includes(lg)) mainCats.ETC += count;
                else if (catNonMetal.includes(lg)) mainCats["Non-Metal"] += count;
                else mainCats.Besorolatlan += count;
            });

            chartLabels = Object.keys(mainCats)
                .filter((k) => mainCats[k] > 0)
                .sort((a, b) => mainCats[b] - mainCats[a]);
            chartData = chartLabels.map((k) => mainCats[k]);
        } else {
            let targetList = [];
            if (currentGenreLevel === "Death") targetList = catDeath;
            else if (currentGenreLevel === "Black") targetList = catBlack;
            else if (currentGenreLevel === "Core") targetList = catCore;
            else if (currentGenreLevel === "Heavy") targetList = catHeavy;
            else if (currentGenreLevel === "ETC") targetList = catEtc;
            else if (currentGenreLevel === "Non-Metal") targetList = catNonMetal;

            const subGenres = {};
            Object.entries(genres).forEach(([genreName, count]) => {
                if (targetList.includes(genreName.toLowerCase())) subGenres[genreName] = count;
            });

            chartLabels = Object.keys(subGenres).sort((a, b) => subGenres[b] - subGenres[a]);
            chartData = chartLabels.map((k) => subGenres[k]);
        }

        const bgColors = chartLabels.map((label, i) => {
            if (label === "Besorolatlan") return "#333333";
            return `hsl(48, 100%, ${Math.max(15, 50 - i * 6)}%)`;
        });

        if (charts.g) charts.g.destroy();
        charts.g = new Chart(document.getElementById("cGenre"), {
            type: "pie",
            data: {
                labels: chartLabels,
                datasets: [{ data: chartData, backgroundColor: bgColors, borderWidth: 1, borderColor: "#1e1e1e", radius: "95%" }]
            },
            options: {
                devicePixelRatio: 2,
                maintainAspectRatio: false,
                layout: { padding: { top: 20, bottom: 20, left: 30, right: 30 } },
                onClick: (e, el) => {
                    if (el[0]) {
                        const label = chartLabels[el[0].index];
                        if (getCurrentGenreLevel() === "main") {
                            if (label !== "Besorolatlan") {
                                setCurrentGenreLevel(label);
                                window.renderStats();
                            }
                        } else {
                            window.qFilter("g", label);
                        }
                    } else if (getCurrentGenreLevel() !== "main") {
                        setCurrentGenreLevel("main");
                        window.renderStats();
                    }
                },
                onHover: (event, chartElement) => {
                    event.native.target.style.cursor = chartElement[0] ? "pointer" : "default";
                },
                plugins: {
                    legend: { display: false },
                    datalabels: { anchor: "end", align: "end", color: "#ccc", offset: 10, font: { size: 11 }, formatter: (v, ctx) => ctx.chart.data.labels[ctx.dataIndex] }
                }
            }
        });

        document.getElementById("stat-total-albums").innerText = albums.length;
        document.getElementById("stat-total-artists").innerText = uniqueArtists.size;
        document.getElementById("stat-total-genres").innerText = uniqueGenres.size;
        document.getElementById("stat-avg-score").innerText = validAlbumCount > 0 ? (totalScore / validAlbumCount).toFixed(2) : "0.00";
        document.getElementById("stat-total-yap").innerText = totalWords + " szo";

        let incompleteCount = 0;
        albums.forEach((a) => {
            const isInc = isMissing(a.review) || isMissing(a.favSong) || isMissing(a.coverUrl) || isMissing(a.year) || isMissing(a.album) || isMissing(a.genre);
            if (isInc) incompleteCount++;
        });

        const statIncompleteEl = document.getElementById("stat-incomplete");
        if (statIncompleteEl) statIncompleteEl.innerText = incompleteCount;

        const getMedian = (obj) => {
            const vals = Object.values(obj).sort((a, b) => a - b);
            if (vals.length === 0) return 1;
            const mid = Math.floor(vals.length / 2);
            const m = vals.length % 2 !== 0 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
            return Math.max(1, Math.floor(m));
        };

        const gMedian = getMedian(genres);
        const yMedian = getMedian(years);
        const topSortAsc = getTopSortAsc();

        const drawTopList = (scoreObj, type, threshold) =>
            Object.entries(scoreObj)
                .filter(([, scores]) => scores.length >= threshold)
                .map(([name, scores]) => ({ name, avg: scores.reduce((p, c) => p + c, 0) / scores.length, count: scores.length }))
                .sort((a, b) => (topSortAsc ? a.avg - b.avg : b.avg - a.avg))
                .slice(0, 10)
                .map(
                    (i) => `<li onclick="qFilter('${type}','${i.name}')"><div style="display:flex; flex-direction:column;"><span>${i.name}</span><small style="color:#888; font-size:0.7em;">${i.count} db</small></div><span class="stat-score-pill" style="background:hsl(${(i.avg - 1) * 13},70%,40%)">${i.avg.toFixed(2)}</span></li>`
                )
                .join("");

        document.getElementById("topTitle").innerHTML = `${topSortAsc ? "Bottom 10" : "Top 10"} <span style="font-size:0.6em; color:#888; font-weight:normal; margin-left:10px;">(min.${gMedian}/mufaj, min.${yMedian}/ev)</span>`;
        document.getElementById("topG").innerHTML = drawTopList(gScores, "g", gMedian);
        document.getElementById("topY").innerHTML = drawTopList(yScores, "y", yMedian);

        const genreEntries = Object.entries(genres);

        if (charts.traits) charts.traits.destroy();
        const traitKeys = ["riff", "vox", "dob", "mix", "szoveg", "vibe"];
        const traitLabels = ["RIFFEK", "VOX", "DOBOK", "MIX", "SZOVEG", "VIBE"];
        const ratings = ["Peak", "Igen", "Meh", "Nem", "Poop", "Volt??"];
        const rColors = { Peak: "#ffcc00", Igen: "#44ff44", Meh: "#888888", Nem: "#ff4444", Poop: "#8b4513", "Volt??": "#bb88ff" };

        const traitCounts = {};
        ratings.forEach((r) => {
            traitCounts[r] = [0, 0, 0, 0, 0, 0];
        });

        albums.forEach((a) => {
            const t = a.traits || { riff: "Meh", vox: "Meh", dob: "Meh", mix: "Meh", szoveg: "Meh", vibe: "Meh" };
            traitKeys.forEach((key, i) => {
                const val = t[key] || "Meh";
                if (traitCounts[val]) traitCounts[val][i]++;
            });
        });

        const totalAlbums = albums.length;
        charts.traits = new Chart(document.getElementById("chartTraits"), {
            type: "bar",
            data: {
                labels: traitLabels,
                datasets: ratings.map((r) => ({ label: r, data: traitCounts[r].map((c) => (totalAlbums ? Math.round((c / totalAlbums) * 100) : 0)), backgroundColor: rColors[r] }))
            },
            options: {
                indexAxis: "y",
                maintainAspectRatio: false,
                scales: { x: { stacked: true, max: 100, display: false }, y: { stacked: true, ticks: { color: "#eee", font: { weight: "bold" } } } },
                plugins: { legend: { position: "bottom", labels: { color: "#ccc", boxWidth: 12 } }, datalabels: { color: "#000", font: { weight: "bold", size: 10 }, formatter: (v) => (v > 5 ? v + "%" : "") } }
            }
        });

        if (charts.y) charts.y.destroy();
        const ySorted = Object.keys(years).sort();
        charts.y = new Chart(document.getElementById("cYear"), {
            type: "bar",
            data: { labels: ySorted, datasets: [{ data: ySorted.map((k) => years[k]), backgroundColor: "#ffcc00" }] },
            options: {
                devicePixelRatio: 2,
                indexAxis: "x",
                onClick: (e, el) => {
                    if (el[0]) window.qFilter("y", ySorted[el[0].index]);
                },
                maintainAspectRatio: false,
                layout: { padding: { top: 25, right: 10 } },
                plugins: { legend: { display: false }, datalabels: { display: true, anchor: "end", align: "top", color: "#ffcc00", font: { weight: "bold", size: 11 }, formatter: (v) => v } },
                scales: { y: { beginAtZero: true, grid: { color: "#333" }, ticks: { color: "#ccc" } }, x: { grid: { display: false }, ticks: { color: "#ccc", autoSkip: false, maxRotation: 45, minRotation: 45 } } }
            }
        });

        if (charts.s) charts.s.destroy();
        const p = albums.length > 0 ? ((sCount / albums.length) * 100).toFixed(1) : 0;
        charts.s = new Chart(document.getElementById("cSlop"), {
            type: "bar",
            data: { labels: [""], datasets: [{ data: [p], backgroundColor: "#ffcc00" }, { data: [100 - p], backgroundColor: "#333" }] },
            options: { devicePixelRatio: 2, maintainAspectRatio: false, scales: { x: { stacked: true, display: false }, y: { stacked: true, max: 100, display: false } }, plugins: { datalabels: { color: "#fff", formatter: (v) => v + "%" }, legend: { display: false } } }
        });

        document.getElementById("listRare").innerHTML = genreEntries
            .filter((e) => e[1] < rareLimit)
            .sort((a, b) => b[1] - a[1])
            .map((r) => `<li onclick="qFilter('g','${r[0]}')">${r[0]} <span>${r[1]} db</span></li>`)
            .join("");

        const recStats = Object.keys(recommenders).map((key) => {
            const rData = recommenders[key];
            const rAlbums = albums.filter((a) => a.recommender === key && (parseFloat(a.myScore) || 0) > 0);
            const count = rAlbums.length;
            const avg = count > 0 ? rAlbums.reduce((sum, a) => sum + (parseFloat(a.myScore) || 0), 0) / count : 0;
            return { key, ...rData, count, avg };
        });

        const drawRecStats = (data) => {
            const container = document.getElementById("listRecStats");
            if (!container) return;

            let html = `
                <li style="background:none; border:none; cursor:default; font-weight:bold; color:var(--accent); font-size:14px; padding:0 10px; min-height:auto; margin-bottom:5px;">
                    <div style="flex:1;">NEV</div>
                    <div style="width:100px; text-align:center; cursor:pointer;" onclick="sortRecStats('count')">DARAB ⇅</div>
                    <div style="width:100px; text-align:right; cursor:pointer;" onclick="sortRecStats('avg')">ATLAG ⇅</div>
                </li>`;

            data.forEach((r) => {
                html += `
                    <li onclick="window.statsToLibrary('${r.key}')" style="cursor:pointer; padding: 12px 10px; border-bottom: 1px solid #333;" class="rec-stat-row">
                        <div style="flex:1; display:flex; align-items:center;">
                            <div class="recommender-tag" style="border-color: ${r.color}; color: ${r.textColor || r.color}; margin:0; padding: 6px 12px; min-width: 140px;">
                                <span class="rec-title" style="font-size: 14px; display: block; line-height: 1.2;">${r.name1}</span>
                                <span class="rec-subtitle" style="font-size: 10px; display: block; opacity: 0.8;">${r.name2}</span>
                            </div>
                        </div>
                        <div style="width:100px; text-align:center; font-weight:bold; font-size:18px;">${r.count}</div>
                        <div class="stat-score-pill" style="background:hsl(${(r.avg - 1) * 13},70%,40%); min-width:65px; font-size:16px; padding: 6px;">${r.avg.toFixed(2)}</div>
                    </li>`;
            });
            container.innerHTML = html;
        };

        drawRecStats(recStats);
        window.sortRecStats = function(field) {
            if (!window.recSortConfig) window.recSortConfig = { field: null, asc: false };
            if (window.recSortConfig.field === field) window.recSortConfig.asc = !window.recSortConfig.asc;
            else {
                window.recSortConfig.field = field;
                window.recSortConfig.asc = false;
            }
            const sorted = [...recStats].sort((a, b) => (window.recSortConfig.asc ? a[field] - b[field] : b[field] - a[field]));
            drawRecStats(sorted);
        };

        const scoreLabels = [];
        for (let s = 1.0; s <= 10.0; s += 0.5) scoreLabels.push(s.toFixed(1));

        const scoreCounts = new Array(scoreLabels.length).fill(0);
        albums.forEach((a) => {
            const val = parseFloat(a.myScore);
            if (!isNaN(val) && val >= 1 && val <= 10) {
                const rounded = Math.round(val * 2) / 2;
                const index = Math.round((rounded - 1) * 2);
                if (index >= 0 && index < scoreCounts.length) scoreCounts[index]++;
            }
        });

        if (charts.scoreDist) charts.scoreDist.destroy();
        const ctxScore = document.getElementById("cScoreDist").getContext("2d");
        charts.scoreDist = new Chart(ctxScore, {
            type: "bar",
            data: { labels: scoreLabels, datasets: [{ label: "Albumok szama", data: scoreCounts, backgroundColor: "#ffcc00", borderColor: "#ffcc00", borderWidth: 1, borderRadius: 4 }] },
            options: {
                devicePixelRatio: 3,
                responsive: true,
                maintainAspectRatio: false,
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const scoreValue = scoreLabels[index];
                        window.filterByScore(scoreValue);
                    }
                },
                layout: { padding: { top: 25 } },
                plugins: {
                    legend: { display: false },
                    datalabels: { anchor: "end", align: "top", color: "#ffcc00", font: { weight: "bold", size: 14 }, formatter: (value) => (value > 0 ? value : "") }
                },
                scales: {
                    y: { beginAtZero: true, grid: { display: false }, ticks: { display: false }, border: { display: false } },
                    x: { grid: { display: false }, ticks: { color: "#e0e0e0", font: { size: 14, weight: "bold" } } }
                }
            },
            plugins: [ChartDataLabels]
        });
    };

    window.captureStats = async function(eventArg) {
        const clickEvent = eventArg || window.event;
        if (!clickEvent || !clickEvent.target) return;

        const msg = document.getElementById("snapshotMsg");
        const statsPage = document.getElementById("stats");
        const btnContainer = clickEvent.target.parentElement;

        const originalBtnText = clickEvent.target.innerText;
        clickEvent.target.innerText = "GENERARAS...";
        clickEvent.target.disabled = true;
        btnContainer.style.display = "none";

        try {
            const canvas = await html2canvas(statsPage, {
                backgroundColor: "#121212",
                scale: 3,
                logging: false,
                useCORS: true,
                scrollX: 0,
                scrollY: -window.scrollY,
                windowWidth: statsPage.scrollWidth,
                windowHeight: statsPage.scrollHeight
            });

            btnContainer.style.display = "block";

            canvas.toBlob(async (blob) => {
                try {
                    const data = [new ClipboardItem({ [blob.type]: blob })];
                    await navigator.clipboard.write(data);
                    msg.innerText = "Kep a vagolapra masolva!";
                    msg.style.display = "block";
                } catch (err) {
                    const link = document.createElement("a");
                    link.download = "slop_library_statisztika.png";
                    link.href = canvas.toDataURL("image/png");
                    link.click();
                    msg.innerText = "Vagolap hiba - Kep letoltve!";
                    msg.style.display = "block";
                }
            });
        } catch (err) {
            console.error("Hiba:", err);
            btnContainer.style.display = "block";
            alert("Hiba tortent a generalas kozben.");
        } finally {
            clickEvent.target.innerText = originalBtnText;
            clickEvent.target.disabled = false;
            setTimeout(() => {
                msg.style.display = "none";
            }, 4000);
        }
    };
}
