export function getRecommenderHTML(recommenders, recKey) {
    if (!recKey || !recommenders[recKey]) return "";

    const data = recommenders[recKey];
    const displayTextColor = data.textColor || data.color;

    return `
        <div class="recommender-container">
            <span class="rec-label">Ajánlotta:</span>
            <div class="recommender-tag" style="border-color: ${data.color}; color: ${displayTextColor};">
                <span class="rec-title">${data.name1}</span>
                <span class="rec-subtitle">${data.name2}</span>
            </div>
        </div>`;
}
