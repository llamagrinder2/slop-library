export function initSpotifyService({
    getToken,
    setToken,
    onTrackPicked,
    onTokenAcquired
}) {
    const clientId = "ed9b786710994376bba52f4ea5ebae64";
    const redirectUri = "https://www.sloplibrary.hu";
    const AUTH_INTENT_KEY = "spotify_auth_intent";
    const REDIRECT_PAGE_KEY = "spotify_redirect_page_state";

    const captureCurrentAppState = () => {
        try {
            const activePage = document.querySelector(".page.active")?.id || "library";
            const addTodoPanel = document.getElementById("mod-addTodo");
            const artistInput = document.getElementById("todoArtist");
            const todoQueryInput = document.getElementById("todoQuery");
            const librarySearchInput = document.getElementById("gSearch");
            const libraryArtistInput = document.getElementById("fArtist");

            return {
                page: activePage,
                openAddTodo: Boolean(addTodoPanel && addTodoPanel.style.display === "block"),
                artist: artistInput ? artistInput.value : "",
                todoQuery: todoQueryInput ? todoQueryInput.value : "",
                libraryQuery: librarySearchInput ? librarySearchInput.value : "",
                libraryArtist: libraryArtistInput ? libraryArtistInput.value : ""
            };
        } catch (err) {
            return { page: "library" };
        }
    };

    const persistCurrentPageState = () => {
        try {
            window.localStorage.setItem(REDIRECT_PAGE_KEY, JSON.stringify(captureCurrentAppState()));
        } catch (e) {
            console.warn("Spotify redirect state save failed:", e);
        }
    };

    const restoreCurrentPageState = () => {
        try {
            const raw = window.localStorage.getItem(REDIRECT_PAGE_KEY);
            if (!raw) return;
            const state = JSON.parse(raw);
            window.localStorage.removeItem(REDIRECT_PAGE_KEY);

            if (!state || !state.page) return;

            if (typeof window.showPage === "function") {
                window.showPage(state.page);
            }

            if (state.page === "todo") {
                if (state.openAddTodo) {
                    const panel = document.getElementById("mod-addTodo");
                    if (panel && panel.style.display !== "block" && typeof window.toggleMod === "function") {
                        window.toggleMod("addTodo");
                    }
                }
                const artistInput = document.getElementById("todoArtist");
                if (artistInput && state.artist) {
                    artistInput.value = state.artist;
                    artistInput.focus();
                }
            }

            if (state.page === "library") {
                const searchInput = document.getElementById("gSearch");
                const artistSelect = document.getElementById("fArtist");
                if (searchInput && state.libraryQuery) searchInput.value = state.libraryQuery;
                if (artistSelect && state.libraryArtist) artistSelect.value = state.libraryArtist;
                if (typeof window.runFilter === "function") {
                    window.runFilter(true);
                }
            }
        } catch (err) {
            console.warn("Spotify redirect state restore failed:", err);
            try {
                window.localStorage.removeItem(REDIRECT_PAGE_KEY);
            } catch {}
        }
    };

    const setAuthIntent = (intent) => {
        try {
            window.localStorage.setItem(AUTH_INTENT_KEY, intent || "library-import");
        } catch (e) {
            console.warn("Spotify auth intent save failed:", e);
        }
    };

    const consumeAuthIntent = () => {
        try {
            const intent = window.localStorage.getItem(AUTH_INTENT_KEY) || "library-import";
            window.localStorage.removeItem(AUTH_INTENT_KEY);
            return intent;
        } catch {
            return "library-import";
        }
    };

    const shouldOpenImportModal = (intent) => intent === "library-import";

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

    window.authSpotify = async function(intent = "library-import") {
        setAuthIntent(intent);
        persistCurrentPageState();

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

    window.isSpotifySessionValid = async function() {
        const token = getToken();
        if (!token) return false;

        try {
            const response = await fetch("https://api.spotify.com/v1/me", {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.status === 401) return false;
            return response.ok;
        } catch (err) {
            console.warn("Spotify session check failed:", err);
            return false;
        }
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

            // compute total album length and set input if available
            if (data.tracks && data.tracks.items) {
                const totalMs = data.tracks.items.reduce((s, t) => s + (t.duration_ms || 0), 0);
                const totalSeconds = Math.floor(totalMs / 1000);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                const formatted = hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${minutes}:${String(seconds).padStart(2, "0")}`;
                const inLenEl = document.getElementById("inLength");
                if (inLenEl) inLenEl.value = formatted;
            }

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
                const intent = consumeAuthIntent();

                if (typeof onTokenAcquired === "function") {
                    try {
                        await onTokenAcquired({
                            token: response.access_token,
                            intent
                        });
                    } catch (resumeErr) {
                        console.warn("Spotify post-auth handler failed:", resumeErr);
                    }
                }

                window.history.replaceState({}, document.title, window.location.pathname);
                restoreCurrentPageState();
                if (shouldOpenImportModal(intent)) {
                    const addPanel = document.getElementById("mod-add");
                    const modal = document.getElementById("spotifyModal");
                    if (addPanel) addPanel.style.display = "block";
                    if (modal) modal.style.display = "flex";
                }
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
            const intent = consumeAuthIntent();

            if (typeof onTokenAcquired === "function") {
                try {
                    await onTokenAcquired({
                        token: hash.access_token,
                        intent
                    });
                } catch (resumeErr) {
                    console.warn("Spotify post-auth handler failed:", resumeErr);
                }
            }

            window.location.hash = "";
            restoreCurrentPageState();
            if (shouldOpenImportModal(intent)) {
                const modal = document.getElementById("spotifyModal");
                if (modal) modal.style.display = "flex";
            }
        }
    });
}
