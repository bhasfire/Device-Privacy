import express from "express";
import { getInstalledApps } from "../services/installedAppsScanner.js";
import { getPermissionScore } from "../services/permissionScanner.js";

const router = express.Router();

// Route to fetch installed applications
router.get("/installed-apps", async (req, res) => {
    try {
        const apps = await getInstalledApps();
        res.json({ installedApps: apps });
    } catch (error) {
        console.error("Error retrieving installed apps:", error);
        res.status(500).json({ error: "Failed to fetch installed applications." });
    }
});

// API to fetch permissions for a specific app
router.get("/permissions/:appPath", async (req, res) => {
    try {
        const { appPath } = req.params;
        const decodedPath = decodeURIComponent(appPath);
        const result = await getPermissionScore(decodedPath);
        res.json(result);
    } catch (error) {
        console.error("Error fetching permissions:", error);
        res.status(500).json({ error: "Unable to determine permissions" });
    }
});

export default router;
