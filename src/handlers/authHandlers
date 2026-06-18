export function registerAuthHandlers({
    auth,
    provider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    getCurrentUser,
    setCurrentUser,
    showPage,
    runFilter
}) {
    let titleClickCount = 0;

    async function login() {
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Bejelentkezesi hiba:", error);
        }
    }

    async function logout() {
        await signOut(auth);
        location.reload();
    }

    window.handleTitleClick = function() {
        titleClickCount++;
        if (titleClickCount === 3) {
            titleClickCount = 0;
            if (!getCurrentUser()) {
                login();
            } else if (confirm("Ki akarsz jelentkezni?")) {
                logout();
            }
        }
        setTimeout(() => {
            titleClickCount = 0;
        }, 2000);
    };

    window.handleMobileSidebarAuth = async function() {
        if (!getCurrentUser()) {
            await login();
        } else if (confirm("Ki akarsz jelentkezni?")) {
            await logout();
        }

        if (typeof window.closeMobileMenu === "function") {
            window.closeMobileMenu();
        }
    };

    onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        const settingsMenu = document.querySelector('button[onclick*="settings"]');
        const mobileAuthBtn = document.getElementById("mobileAuthBtn");

        if (user) {
            console.log("Bejelentkezve:", user.email);
            document.body.classList.add("is-admin");
            if (settingsMenu) settingsMenu.style.display = "inline-block";
            if (mobileAuthBtn) mobileAuthBtn.innerText = "KIJELENTKEZÉS";
        } else {
            console.log("Vendeg mod");
            document.body.classList.remove("is-admin");
            if (settingsMenu) settingsMenu.style.display = "none";
            if (mobileAuthBtn) mobileAuthBtn.innerText = "BEJELENTKEZÉS";
            showPage("library");
        }

        runFilter();
    });
}
