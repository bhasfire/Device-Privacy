import fs from "fs";
import path from "path";
import * as pe from "pe-library";

// High-risk DLLs for EXE files
const PERMISSION_RISKS = {
    "advapi32.dll": 3, // Registry access
    "user32.dll": 2,   // UI manipulation
    "kernel32.dll": 1, // General system access
    "wininet.dll": 3,  // Internet access
    "ws2_32.dll": 3    // Network access
};

// Scan permissions for an application
async function getPermissionScore(appPath) {
    try {
        const appType = determineAppType(appPath);

        if (appType === "UWP") {
            return scanUwpPermissions(appPath);
        } else if (appType === "EXE") {
            return await scanExePermissions(appPath);
        }

        return { score: 0, permissions: [] };
    } catch (error) {
        console.error("Error scanning permissions:", error);
        return { score: 0, permissions: ["Unknown"] };
    }
}

// Determine if the app is EXE or UWP
function determineAppType(appPath) {
    if (appPath.includes("WindowsApps")) return "UWP";
    if (appPath.endsWith(".exe")) return "EXE";
    return "UNKNOWN";
}

// Scan UWP permissions from AppxManifest.xml
function scanUwpPermissions(appPath) {
    const manifestPath = path.join(appPath, "AppxManifest.xml");
    if (!fs.existsSync(manifestPath)) return { score: 0, permissions: ["Unknown"] };

    const manifestData = fs.readFileSync(manifestPath, "utf-8");
    const permissions = [];

    if (manifestData.includes("internetClient")) permissions.push("Internet Access");
    if (manifestData.includes("location")) permissions.push("Location");
    if (manifestData.includes("webcam")) permissions.push("Camera");
    if (manifestData.includes("microphone")) permissions.push("Microphone");

    const score = Math.min(permissions.length * 20, 100);
    return { score, permissions };
}

// Scan EXE permissions by analyzing imported DLLs
async function scanExePermissions(exePath) {
    try {
        const peFile = await pe.PortableExecutable.fromFile(exePath);
        const importedDLLs = peFile.getImports().map(entry => entry.module.toLowerCase());

        let score = 0;
        const permissions = [];

        importedDLLs.forEach(dll => {
            if (PERMISSION_RISKS[dll]) {
                score += PERMISSION_RISKS[dll] * 10;
                permissions.push(dll.replace(".dll", ""));
            }
        });

        return { score: Math.min(score, 100), permissions };
    } catch (error) {
        return { score: 0, permissions: ["Unknown"] };
    }
}

export { getPermissionScore };
