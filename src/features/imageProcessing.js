export function initMobileHeaderAutoHide() {
    const MOBILE_MAX_WIDTH = 815;
    let lastScrollY = window.scrollY;

    function handleScroll() {
        if (window.innerWidth > MOBILE_MAX_WIDTH) return;

        const currentY = window.scrollY;
        const goingDown = currentY > lastScrollY;

        if (goingDown && currentY > 50) {
            document.body.classList.add("nav-hidden-mobile");
        } else if (currentY < lastScrollY) {
            document.body.classList.remove("nav-hidden-mobile");
        }

        lastScrollY = currentY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
}

export function registerHueExtraction() {
    window.extractHueFromFile = (file) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
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

                r = Math.floor(r / c);
                g = Math.floor(g / c);
                b = Math.floor(b / c);

                r /= 255;
                g /= 255;
                b /= 255;
                let max = Math.max(r, g, b);
                let min = Math.min(r, g, b);
                let h = 0;
                if (max !== min) {
                    let d = max - min;
                    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
                    else if (max === g) h = (b - r) / d + 2;
                    else h = (r - g) / d + 4;
                    h /= 6;
                }
                resolve(Math.round(h * 360));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}
