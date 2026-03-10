const { addonBuilder } = require("stremio-addon-sdk");
const axios = require("axios");
const manifest = require("./manifest");

const builder = new addonBuilder(manifest);

// Helper function to get localized name from Cinemeta
async function getCinemetaTitle(type, id) {
    try {
        const url = `https://v3-cinemeta.strem.io/meta/${type}/${id}.json`;
        const response = await axios.get(url);
        if (response.data && response.data.meta && response.data.meta.name) {
            return response.data.meta.name;
        }
    } catch (e) {
        console.error("Error fetching Cinemeta info:", e.message);
    }
    return null;
}

// Function to search Hellspy
async function searchHellspy(query) {
    try {
        const url = `https://api.hellspy.to/gw/search?query=${encodeURIComponent(query)}&offset=0&limit=15`;
        const response = await axios.get(url);

        if (response.data && response.data.items) {
            return response.data.items;
        }
    } catch (e) {
        console.error("Error searching Hellspy:", e.message);
    }
    return [];
}

// Stream handler
builder.defineStreamHandler(async ({ type, id }) => {
    console.log(`[Stream Request] Type: ${type}, ID: ${id}`);

    // For series, id is like tt1234567:1:2 (imdbID:season:episode)
    const imdbId = id.split(":")[0];

    const title = await getCinemetaTitle(type, imdbId);
    if (!title) {
        return Promise.resolve({ streams: [] });
    }

    console.log(`[Cinemeta Resolved] ID: ${imdbId} -> Title: ${title}`);

    // We will search for the title and maybe append CZ/SK or season/episode for series
    let searchQuery = title;
    if (type === "series") {
        const season = id.split(":")[1];
        const episode = id.split(":")[2];
        const seasonStr = season.padStart(2, "0");
        const episodeStr = episode.padStart(2, "0");
        searchQuery += ` S${seasonStr}E${episodeStr}`;
    }

    console.log(`[Hellspy Search] Query: ${searchQuery}`);
    const results = await searchHellspy(searchQuery);

    const streams = results.map(item => {
        // Velikost v MB
        const sizeMb = (item.size / (1024 * 1024)).toFixed(0);

        // Vlastní přesměrovávací endpoint - bude spuštěn na stejném serveru jako addon
        // Předpokládáme, že public URL bude nastavena v appce (zatím použijeme localhost jako mock, nebo relativní cestu ve Stremiu nelze použít, musíme uvést full proxy URL)
        // Express.js doplní hlavičky z req.host 

        // Return stream configuration
        return {
            name: "Hellspy",
            description: `${item.title}\\n📦 ${sizeMb} MB`,
            // Odkazujeme na náš lokální Express server endpoint pro the konkrétní video
            // Addon SDK samo o sobě tohle nezvládne zpracovat relativně, musíme mu poslat plnou URL
            // Během instalace pluginu to bude na `http://127.0.0.1:7000/play/:id/:hash`
            url: `http://127.0.0.1:7000/play/${item.id}/${item.fileHash}`
        };
    });

    return Promise.resolve({ streams });
});

module.exports = builder.getInterface();
