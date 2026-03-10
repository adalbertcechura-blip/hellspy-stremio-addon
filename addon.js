const { addonBuilder } = require("stremio-addon-sdk");
const axios = require("axios");
const manifest = require("./manifest");

const builder = new addonBuilder(manifest);

const axiosConfig = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
};

// Helper function to get localized name from Cinemeta
async function getCinemetaTitle(type, id) {
    try {
        const url = `https://v3-cinemeta.strem.io/meta/${type}/${id}.json`;
        const response = await axios.get(url, axiosConfig);
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
        const response = await axios.get(url, axiosConfig);

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

    // Zjistíme URL adresu, odkud požadavek reálně přišel (např. host z Renderu)
    let baseUrl = process.env.BASE_URL || "http://127.0.0.1:7000";

    const imdbId = id.split(":")[0];
    const title = await getCinemetaTitle(type, imdbId);

    if (!title) {
        return Promise.resolve({ streams: [{ name: "Chyba", description: "Cinemeta nevrátila název titulu.\\nPravděpodobně je Render server blokován.", url: "#" }] });
    }

    let searchQuery = title;
    if (type === "series") {
        const season = id.split(":")[1];
        const episode = id.split(":")[2];
        searchQuery += ` S${season.padStart(2, "0")}E${episode.padStart(2, "0")}`;
    }

    try {
        const results = await searchHellspy(searchQuery);

        if (!results || results.length === 0) {
            return Promise.resolve({ streams: [{ name: "Hellspy", description: "Zadaný název '" + searchQuery + "' nenalezl žádné výsledky.", url: "#" }] });
        }

        const streams = results.map(item => {
            const sizeMb = (item.size / (1024 * 1024)).toFixed(0);
            return {
                name: "Hellspy",
                description: `${item.title}\\n📦 ${sizeMb} MB`,
                url: `${baseUrl}/play/${item.id}/${item.fileHash}`
            };
        });

        return Promise.resolve({ streams });
    } catch (e) {
        return Promise.resolve({ streams: [{ name: "API Chyba", description: `Hellspy API havarovalo: ${e.message}`, url: "#" }] });
    }
});

module.exports = builder.getInterface();
