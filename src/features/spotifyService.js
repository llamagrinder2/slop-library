export function initSpotifyService({
    getToken,
    setToken,
    onTrackPicked
}) {
    const clientId = "ed9b786710994376bba52f4ea5ebae64";
    const redirectUri = "https://www.sloplibrary.hu";

    const generateRandomString = (length) => {
        const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        const values = crypto.getRandomValues(new Uint8Array(length));
        return values.reduce((acc, x) => acc + possible[x % possible.length], "");
    };

    const sha256 = async (plain) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(plain);
        return window.crypto.subtle.digest("SHA-256", data);
    };

    const base64encode = (input) => {
        return btoa(String.fromCharCode.apply(null, new Uint8Array(input)))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    };

    window.authSpotify = async function() {
        const codeVerifier = generateRandomString(64);
        const hashed = await sha256(codeVerifier);
        const codeChallenge = base64encode(hashed);

        window.localStorage.setItem("code_verifier", codeVerifier);

        const params = {
            response_type: "code",
            client_id: clientId,
            scope: "user-read-private",
            code_challenge_method: "S256",
            code_challenge: codeChallenge,
            redirect_uri: redirectUri
        };

        const authUrl = new URL("https://accounts.spotify.com/authorize");
        authUrl.search = new URLSearchParams(params).toString();
        window.location.href = authUrl.toString();
    };

    window.closeSpotifyModal = () => {
        const modal = document.getElementById("spotifyModal");
        if (modal) modal.style.display = "none";
    };

    function displayTracks(tracks) {
        const linkStep = document.getElementById("spotifyLinkStep");
        const trackStep = document.getElementById("spotifyTrackStep");
        const list = document.getElementById("trackList");
        if (!linkStep || !trackStep || !list) return;

        linkStep.style.display = "none";
        trackStep.style.display = "block";
        list.innerHTML = "";

        tracks.forEach((track) => {
            const div = document.createElement("div");
            div.style = "padding:10px; border-bottom:1px solid #222; cursor:pointer; font-size:14px; color:#ccc;";
            div.innerText = track.name;
            div.onclick = () => {
                onTrackPicked(track);
                window.closeSpotifyModal();
            };
            div.onmouseover = () => {
                div.style.background = "#222";
            };
            div.onmouseout = () => {
                div.style.background = "transparent";
            };
            list.appendChild(div);
        });
    }

    window.fetchSpotifyAlbum = async function() {
        const link = document.getElementById("spLink")?.value || "";
        const albumId = link.split("/album/")[1]?.split("?")[0];
        if (!albumId) return alert("Ervenytelen Spotify link!");

        try {
            const token = getToken();
            const response = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await response.json();

            document.getElementById("inArtist").value = data.artists.map((a) => a.name).join(", ");
            document.getElementById("inAlbum").value = data.name;
            document.getElementById("inYear").value = data.release_date.split("-")[0];
            document.getElementById("inCover").value = data.images[0].url;

            displayTracks(data.tracks.items);
        } catch (err) {
            console.error(err);
            alert("Hiba az adatok lekeresekor.");
        }
    };

    window.addEventListener("load", async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");

        if (code) {
            const codeVerifier = window.localStorage.getItem("code_verifier");
            const payload = {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: clientId,
                    grant_type: "authorization_code",
                    code,
                    redirect_uri: redirectUri,
                    code_verifier: codeVerifier
                })
            };

            const body = await fetch("https://accounts.spotify.com/api/token", payload);
            const response = await body.json();
            if (response.access_token) {
                setToken(response.access_token);
                window.history.replaceState({}, document.title, window.location.pathname);
                const addPanel = document.getElementById("mod-add");
                const modal = document.getElementById("spotifyModal");
                if (addPanel) addPanel.style.display = "block";
                if (modal) modal.style.display = "flex";
            }
        }

        const hash = window.location.hash.substring(1).split("&").reduce((initial, item) => {
            if (item) {
                const parts = item.split("=");
                initial[parts[0]] = decodeURIComponent(parts[1]);
            }
            return initial;
        }, {});

        if (hash.access_token) {
            setToken(hash.access_token);
            window.location.hash = "";
            const modal = document.getElementById("spotifyModal");
            if (modal) modal.style.display = "flex";
        }
    });
}
