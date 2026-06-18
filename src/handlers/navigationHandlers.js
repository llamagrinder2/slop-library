export function registerNavigationHandlers({
    getAlbums,
    renderExcelTable,
    renderGallery,
    renderStats,
    initFilters,
    runFilter,
    renderSettings,
    renderTodo,
    getSortAsc,
    setSortAsc,
    setCurrentPage,
    getTopSortAsc,
    setTopSortAsc
}) {
    window.toggleSortOrder = function() {
        setSortAsc(!getSortAsc());
        document.getElementById("sortDirIcon").innerText = getSortAsc() ? "▲" : "▼";
        setCurrentPage(1);
        runFilter();
    };

    window.toggleTopSort = function() {
        setTopSortAsc(!getTopSortAsc());
        document.getElementById("sortIcon").innerText = getTopSortAsc() ? "⇵" : "⇅";
        renderStats();
    };

    window.showPage = function(id) {
        document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
        document.querySelectorAll(".nav-links button, .mobile-sidebar-links button").forEach((b) => b.classList.remove("active"));

        const target = document.getElementById(id);
        if (target) target.classList.add("active");

        document.querySelectorAll(`[data-nav-target="${id}"]`).forEach((btn) => btn.classList.add("active"));

        if (typeof window.closeMobileMenu === "function") window.closeMobileMenu();

        if (id === "listView") renderExcelTable(getAlbums());
        if (id === "gallery") renderGallery();
        if (id === "stats") renderStats();
        if (id === "library") {
            initFilters();
            runFilter();
        }
        if (id === "settings") renderSettings();
        if (id === "todo") renderTodo();
    };

    window.toggleMod = function(m) {
        const spBtn = document.getElementById("btn-sp-import");
        const panels = {
            add: document.getElementById("mod-add"),
            search: document.getElementById("mod-search"),
            addTodo: document.getElementById("mod-addTodo")
        };

        for (const key in panels) {
            if (!panels[key]) continue;
            if (key === m) {
                panels[key].style.display = panels[key].style.display === "block" ? "none" : "block";
            } else {
                panels[key].style.display = "none";
            }
        }

        if (spBtn) {
            spBtn.style.display = panels.add && panels.add.style.display === "block" ? "inline-block" : "none";
        }
    };
}
