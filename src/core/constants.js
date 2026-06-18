export const TRAIT_VALUES = ["Volt??", "Poop", "Nem", "Meh", "Igen", "Peak"];

export const TRAIT_ORDER = {
    Peak: 5,
    Igen: 4,
    Meh: 3,
    Nem: 2,
    Poop: 1,
    "Volt??": 0
};

export const COUNTRY_ALPHA3_TO_ALPHA2 = {
    HUN: "hu",
    USA: "us",
    SWE: "se",
    FIN: "fi",
    DEU: "de",
    GBR: "gb",
    NOR: "no",
    FRA: "fr",
    ITA: "it",
    CAN: "ca",
    AUS: "au",
    JPN: "jp",
    BRA: "br",
    POL: "pl",
    GRC: "gr",
    UKR: "ua",
    CZE: "cz",
    CHE: "ch",
    AUT: "at",
    BEL: "be",
    NLD: "nl"
};

export function getCountryFlag(countryCode) {
    if (!countryCode) return "";
    const code = countryCode.toUpperCase();
    const alpha2 = COUNTRY_ALPHA3_TO_ALPHA2[code];
    if (!alpha2) return "";
    return `<img src="https://flagcdn.com/16x12/${alpha2}.png" width="16" height="12" alt="${code}" style="vertical-align: middle; margin-left: 8px; border-radius: 2px;">`;
}

export const recommenders = {
    baal: { name1: "The Almighty Baal", name2: "Menace of Bikini Bottom", color: "#FFEB3B" },
    goatlord: { name1: "Goatlord", name2: "Heir to the Black/Speed Throne", color: "#606060", textColor: "#bbb" },
    caller: { name1: "Caller of Slam Riffs", name2: "Desecrator of Snare Drums", color: "#1E88E5" },
    bacchus: { name1: "Bacchus the Second", name2: "the Sodomizer, the Bluntripper", color: "#4CAF50" },
    mammvth: { name1: "The Mammvth Hvnter", name2: "He Who Preys on Dissodeath", color: "#8D6E63" },
    gaben: { name1: "X14Gaben88X", name2: "Straightest of all Edges", color: "#AB47BC" },
    christian: { name1: "Christian Woman", name2: "The wicked wicca", color: "#FF9800" },
    max: { name1: "Max, the Mad", name2: "Undercover cartel member", color: "#E8E8E8" }
};
