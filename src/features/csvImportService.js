export function registerCsvImport({
    getAlbums,
    setAlbums,
    saveToFirebase
}) {
    window.handleCSV = function() {
        const file = document.getElementById("csvFileInput")?.files?.[0];
        if (!file) return alert("Nincs fajl!");

        const reader = new FileReader();
        reader.onload = async function(e) {
            const lines = e.target.result.split("\n");
            const header = lines[0].toLowerCase().trim().split(";");
            const newAlbums = [];

            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                const cells = lines[i].split(";");
                const album = {};

                header.forEach((name, idx) => {
                    const v = cells[idx] ? cells[idx].trim() : "";
                    if (name.includes("artist") || name.includes("eloado") || name.includes("előadó")) album.artist = v;
                    if (name.includes("album")) album.album = v;
                    if (name.includes("year") || name.includes("ev") || name.includes("év")) album.year = v;
                    if (name.includes("genre") || name.includes("mufaj") || name.includes("műfaj")) album.genre = v;
                    if (name.includes("score") || name.includes("pont")) album.myScore = parseFloat(v.replace(",", ".")) || 0;
                    if (name.includes("cover")) album.coverUrl = v;
                    if (name.includes("review") || name.includes("velemeny") || name.includes("vélemény")) album.review = v;
                    if (name === "favorite") album.favSong = v;
                    if (name === "link") album.songUrl = v;
                    if (name === "id" || name.includes("sorszam") || name.includes("sorszám")) album.id = parseInt(v, 10);
                });

                if (album.artist && album.album) newAlbums.push(album);
            }

            if (!newAlbums.length) return;

            const merged = [...getAlbums(), ...newAlbums];
            setAlbums(merged);

            try {
                await saveToFirebase();
                localStorage.setItem("slopLibrary", JSON.stringify(merged));
                alert(newAlbums.length + " album hozzaadva es felhobe mentve!");
                location.reload();
            } catch (err) {
                console.error("Hiba az importalas kozben:", err);
                alert("Hiba tortent a felhobe menteskor!");
            }
        };

        reader.readAsText(file, "UTF-8");
    };
}
