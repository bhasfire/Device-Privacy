import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

// List of keywords to filter out system apps, runtimes, and background utilities
const SYSTEM_APP_KEYWORDS = [
    "microsoft.windows", "microsoft.bing", "microsoft.office", "microsoft.edge", 
    "microsoft.skype", "microsoft.zune", "microsoft.xbox", "vclibs", "directx", 
    "runtime", "uwpdesktop", "appinstaller", "gamingservices", "onedrive", 
    "photos", "store", "feedbackhub", "camera", "calculator"
];

function getInstalledApps() {
    return new Promise((resolve, reject) => {
        let installedApps = [];

        // Query System-Wide Installed Apps (Registry - HKLM)
        exec(
            `powershell -Command "Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Select-Object DisplayName, InstallLocation"`,
            (error, stdout, stderr) => {
                if (!error && !stderr) {
                    const apps = parseRegistryOutput(stdout);
                    installedApps = [...installedApps, ...apps];
                }

                // Query User-Specific Installed Apps (Registry - HKCU)
                exec(
                    `powershell -Command "Get-ItemProperty HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Select-Object DisplayName, InstallLocation"`,
                    (error, stdout, stderr) => {
                        if (!error && !stderr) {
                            const apps = parseRegistryOutput(stdout);
                            installedApps = [...installedApps, ...apps];
                        }

                        // Scan AppData for manually installed/portable apps
                        const localProgramsPath = path.join(os.homedir(), "AppData", "Local", "Programs");
                        if (fs.existsSync(localProgramsPath)) {
                            fs.readdirSync(localProgramsPath).forEach(app => {
                                installedApps.push({ name: app, path: path.join(localProgramsPath, app) });
                            });
                        }

                        // Scan Microsoft Store Apps (UWP) - Requires Admin
                        const uwpPath = "C:\\Program Files\\WindowsApps";
                        if (fs.existsSync(uwpPath)) {
                            fs.readdirSync(uwpPath).forEach(app => {
                                if (app.includes("_") && !isSystemApp(app)) {
                                    installedApps.push({ name: cleanUwpName(app), path: path.join(uwpPath, app) });
                                }
                            });
                        }

                        // Remove duplicates & filter out system apps
                        const uniqueApps = filterUniqueApps(installedApps);
                        resolve(uniqueApps);
                    }
                );
            }
        );
    });
}

// Helper function to parse registry output
function parseRegistryOutput(stdout) {
    return stdout
        .split("\n")
        .map(line => {
            const match = line.match(/(.+?)\s+([A-Z]:\\[^"]+)/);
            return match ? { name: match[1].trim(), path: match[2].trim() } : null;
        })
        .filter(app => app && app.path && fs.existsSync(app.path) && !isSystemApp(app.name));
}

// Helper function to filter out system apps
function isSystemApp(appName) {
    return SYSTEM_APP_KEYWORDS.some(keyword => appName.toLowerCase().includes(keyword));
}

// Helper function to clean up UWP app names
function cleanUwpName(appName) {
    return appName.replace(/[_]+[a-z0-9]+$/, "").replace(/\.[0-9]+/, "").replace(/_/g, " ");
}

// Helper function to remove duplicate app names
function filterUniqueApps(apps) {
    const seen = new Set();
    return apps.filter(app => {
        const key = app.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export { getInstalledApps };
