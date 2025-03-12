import express from "express";
import { getInstalledApps } from "../services/installedAppsScannerWindows.js";
import { getPermissionScore } from "../services/permissionScanner.js";
import { getMacInstalledApps } from "../services/installedAppsScannerMac.js";

const router = express.Router();

// Route to fetch installed Windows applications
router.get("/installed-apps", async (req, res) => {
    try {
        const apps = await getInstalledApps();
        res.json({ installedApps: apps });
    } catch (error) {
        console.error("Error retrieving installed Windows apps:", error);
        res.status(500).json({ error: "Failed to fetch installed Windows applications." });
    }
});

// Route to fetch installed Mac applications
router.get("/installed-apps-mac", async (req, res) => {
    try {
        const apps = await getMacInstalledApps();
        res.json({ installedApps: apps });
    } catch (error) {
        console.error("Error retrieving installed Mac apps:", error);
        res.status(500).json({ error: "Failed to fetch installed Mac applications." });
    }
});

// API to fetch permissions for a specific Windows app
router.get("/permissions/:appPath", async (req, res) => {
    try {
        const { appPath } = req.params;
        const decodedPath = decodeURIComponent(appPath);
        const result = await getPermissionScore(decodedPath);
        res.json(result);
    } catch (error) {
        console.error("Error fetching Windows permissions:", error);
        res.status(500).json({ error: "Unable to determine permissions" });
    }
});

export default router;