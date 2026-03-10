const express = require("express");
const { getRouter } = require("stremio-addon-sdk");
const axios = require("axios");
const cors = require("cors");
const addonInterface = require("./addon");

const app = express();
app.use(cors());

// Serve the Stremio Addon manifest and handlers
app.use("/", getRouter(addonInterface));

// Helper pro vytažení CDN odkazu z Hellspy API a přesměrování (HTTP 302)
app.get("/play/:id/:hash", async (req, res) => {
    const { id, hash } = req.params;
    console.log(`[Stream Play] ID: ${id}, Hash: ${hash}`);

    try {
        const url = `https://api.hellspy.to/gw/video/${id}/${hash}`;
        const response = await axios.get(url);

        if (response.data && response.data.conversions) {
            // Zkusíme najít nejlepší rozlišení, např. 1080p, pak 720p, pak cokoliv
            const conversions = response.data.conversions;
            let streamUrl = null;

            if (conversions["1080"]) streamUrl = conversions["1080"];
            else if (conversions["720"]) streamUrl = conversions["720"];
            else {
                // Vememe libovolný první klíč (např. 480p)
                const keys = Object.keys(conversions);
                if (keys.length > 0) {
                    streamUrl = conversions[keys[0]];
                }
            }

            if (streamUrl) {
                console.log(`[Redirect] -> ${streamUrl}`);
                return res.redirect(302, streamUrl);
            }
        }
    } catch (e) {
        console.error("Error fetching Hellspy video CDN link:", e.message);
    }

    res.status(404).send("Stream nenalezen nebo vypršel na Hellspy.");
});

const PORT = 7000;
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`✅ Hellspy.to Stremio Addon bezi!`);
    console.log(`👉 Zkopiruj tento link do Stremia a nainstaluj:`);
    console.log(`🔗 http://127.0.0.1:${PORT}/manifest.json`);
    console.log(`=========================================`);
});
