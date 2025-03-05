const express = require("express");
const router = express.Router();
const installedAppsScanner = require("../services/installedAppsScanner");

// Route to fetch installed applications
router.get("/installed-apps", async (req, res) => {
    try {
        const apps = await installedAppsScanner.getInstalledApps();
        res.json({ installedApps: apps });
    } catch (error) {
        console.error("Error retrieving installed apps:", error);
        res.status(500).json({ error: "Failed to fetch installed applications." });
    }
});

module.exports = router;
