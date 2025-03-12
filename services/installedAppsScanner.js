import { exec, execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import util from "util";

const execPromise = util.promisify(exec);
const LOG_FILE_PATH = "installed_apps_log.txt";

// Enhanced list of keywords to filter out system apps
const SYSTEM_APP_KEYWORDS = [
    "microsoft.windows", "microsoft.bing", "microsoft.office", "microsoft.edge",
    "microsoft.skype", "microsoft.zune", "microsoft.xbox", "vclibs", "directx",
    "runtime", "uwpdesktop", "appinstaller", "gamingservices", "onedrive",
    "photos", "store", "feedbackhub", "camera", "calculator", "notepad",
    "mspaint", "windowsdefender", "windowssecurity", "paint", "explorer",
    "windowsterminal", "microsoftteams", "system", "config", "driver", "registry",
    "service", "framework", "helper", "update", "installer"
];

// Paths to scan for installed apps
const START_MENU_PATHS = [
    "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs",
    path.join(os.homedir(), "AppData", "Roaming", "Microsoft", "Windows", "Start Menu", "Programs")
];

// Common paths where applications are installed
const COMMON_APP_PATHS = [
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    path.join(os.homedir(), "AppData", "Local", "Programs"),
    "C:\\Program Files\\WindowsApps"
];

/**
 * Main function to get installed applications
 */
async function getInstalledApps() {
    console.log("Scanning for installed applications...");
    let installedApps = [];

    // 1. Get apps from registry (more comprehensive approach)
    const registryApps = await getRegistryInstalledApps();
    console.log(`Found ${registryApps.length} apps from registry`);
    installedApps = [...installedApps, ...registryApps];

    // 2. Get Windows Store (UWP) apps
    try {
        const uwpApps = await getUWPApps();
        console.log(`Found ${uwpApps.length} UWP apps`);
        installedApps = [...installedApps, ...uwpApps];
    } catch (error) {
        console.error("Error getting UWP apps:", error);
    }

    // 3. Scan start menu shortcuts for additional apps
    try {
        const shortcutApps = await scanStartMenuForApps();
        console.log(`Found ${shortcutApps.length} apps from Start Menu shortcuts`);
        installedApps = [...installedApps, ...shortcutApps];
    } catch (error) {
        console.error("Error scanning Start Menu:", error);
    }

    // 4. Scan common installation directories
    try {
        const directoryApps = await scanCommonAppDirectories();
        console.log(`Found ${directoryApps.length} apps from common directories`);
        installedApps = [...installedApps, ...directoryApps];
    } catch (error) {
        console.error("Error scanning app directories:", error);
    }

    // Remove duplicates and system apps
    installedApps = filterUniqueApps(installedApps);
    console.log(`Total unique apps after filtering: ${installedApps.length}`);

    // Write to log file
    writeLogFile(installedApps);

    return installedApps;
}

/**
 * Get installed applications from Windows Registry
 */
async function getRegistryInstalledApps() {
    let apps = [];

    // PowerShell command to get installed apps from the registry
    const psCommand = `
    $apps = @()
    $apps += Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | 
        Where-Object { $_.DisplayName -ne $null } | 
        Select-Object @{Name='Name';Expression={$_.DisplayName}}, 
                     @{Name='Path';Expression={$_.InstallLocation}}
    
    $apps += Get-ItemProperty HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | 
        Where-Object { $_.DisplayName -ne $null } | 
        Select-Object @{Name='Name';Expression={$_.DisplayName}}, 
                     @{Name='Path';Expression={$_.InstallLocation}}
    
    $apps += Get-ItemProperty HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | 
        Where-Object { $_.DisplayName -ne $null } | 
        Select-Object @{Name='Name';Expression={$_.DisplayName}}, 
                     @{Name='Path';Expression={$_.InstallLocation}}
    
    $apps | ConvertTo-Json
    `;

    try {
        const { stdout } = await execPromise(`powershell -Command "${psCommand}"`);
        const parsedApps = JSON.parse(stdout);
        
        // Filter out entries with null or empty paths and system apps
        return parsedApps
            .filter(app => 
                app && 
                app.Name && 
                app.Path && 
                app.Path.trim() !== "" && 
                !isSystemApp(app.Name)
            )
            .map(app => ({
                name: cleanAppName(app.Name),
                path: app.Path
            }));
    } catch (error) {
        console.error("Error getting registry apps:", error);
        return [];
    }
}

/**
 * Get Windows Store (UWP) applications
 */
async function getUWPApps() {
    const uwpApps = [];
    
    // PowerShell command to get UWP apps
    const psCommand = `
    Get-AppxPackage | 
        Where-Object { $_.IsFramework -eq $false -and $_.IsBundle -eq $false } | 
        Select-Object Name, PackageFamilyName, InstallLocation |
        ConvertTo-Json
    `;
    
    try {
        const { stdout } = await execPromise(`powershell -Command "${psCommand}"`);
        const uwpPackages = JSON.parse(stdout);
        
        for (const pkg of uwpPackages) {
            if (!isSystemApp(pkg.Name) && fs.existsSync(pkg.InstallLocation)) {
                uwpApps.push({
                    name: cleanUwpName(pkg.Name),
                    path: pkg.InstallLocation,
                    packageFamilyName: pkg.PackageFamilyName
                });
            }
        }
        
        return uwpApps;
    } catch (error) {
        console.error("Error getting UWP apps:", error);
        return [];
    }
}

/**
 * Scan Start Menu for applications via shortcuts
 */
async function scanStartMenuForApps() {
    const apps = [];
    
    for (const startMenuPath of START_MENU_PATHS) {
        if (!fs.existsSync(startMenuPath)) continue;
        
        const scanDirectory = (dirPath) => {
            const entries = fs.readdirSync(dirPath);
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry);
                
                // Recursively scan subdirectories
                if (fs.statSync(fullPath).isDirectory()) {
                    scanDirectory(fullPath);
                    continue;
                }
                
                // Process shortcuts
                if (entry.endsWith('.lnk')) {
                    try {
                        const targetPath = extractShortcutTarget(fullPath);
                        
                        if (targetPath && 
                            targetPath.toLowerCase().endsWith('.exe') && 
                            fs.existsSync(targetPath) && 
                            !isSystemApp(entry)) {
                            
                            apps.push({
                                name: cleanAppName(entry.replace('.lnk', '')),
                                path: targetPath
                            });
                        }
                    } catch (error) {
                        console.error(`Error processing shortcut ${fullPath}:`, error);
                    }
                }
            }
        };
        
        try {
            scanDirectory(startMenuPath);
        } catch (error) {
            console.error(`Error scanning Start Menu path ${startMenuPath}:`, error);
        }
    }
    
    return apps;
}

/**
 * Scan common app installation directories
 */
async function scanCommonAppDirectories() {
    const apps = [];
    
    for (const dirPath of COMMON_APP_PATHS) {
        if (!fs.existsSync(dirPath)) continue;
        
        try {
            const entries = fs.readdirSync(dirPath);
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry);
                
                // Skip if not a directory or is a system directory
                if (!fs.statSync(fullPath).isDirectory() || isSystemApp(entry)) {
                    continue;
                }
                
                // Check if there's an executable with the same name
                const exePath = path.join(fullPath, `${entry}.exe`);
                
                if (fs.existsSync(exePath)) {
                    apps.push({
                        name: cleanAppName(entry),
                        path: exePath
                    });
                } else {
                    // Look for any executable in the directory
                    const files = fs.readdirSync(fullPath);
                    const exeFiles = files.filter(f => f.endsWith('.exe'));
                    
                    if (exeFiles.length > 0) {
                        apps.push({
                            name: cleanAppName(entry),
                            path: path.join(fullPath, exeFiles[0])
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`Error scanning directory ${dirPath}:`, error);
        }
    }
    
    return apps;
}

/**
 * Extract the target path from a shortcut file
 */
function extractShortcutTarget(shortcutPath) {
    try {
        const result = execSync(`powershell -Command "(New-Object -ComObject WScript.Shell).CreateShortcut('${shortcutPath}').TargetPath"`);
        return result.toString().trim();
    } catch (error) {
        return null;
    }
}

/**
 * Check if an application name matches system app patterns
 */
function isSystemApp(appName) {
    if (!appName) return true;
    
    const lowerName = appName.toLowerCase();
    
    return SYSTEM_APP_KEYWORDS.some(keyword => lowerName.includes(keyword)) ||
           lowerName.includes('microsoft') ||
           lowerName.includes('windows');
}

/**
 * Clean Windows Store (UWP) app names
 */
function cleanUwpName(appName) {
    return appName
        .replace(/[_]+[a-z0-9]+$/, "")
        .replace(/\.[0-9]+$/, "")
        .replace(/_/g, " ")
        .replace(/Microsoft\./i, "");
}

/**
 * Clean regular app names
 */
function cleanAppName(appName) {
    return appName
        .replace(/[_]+[a-z0-9]+$/, "")
        .replace(/\.[0-9]+$/, "")
        .replace(/_/g, " ")
        .trim();
}

/**
 * Filter out duplicate applications
 */
function filterUniqueApps(apps) {
    const seen = new Map();
    
    // First pass - organize by name
    apps.forEach(app => {
        if (!app.name) return;
        
        const cleanName = cleanAppName(app.name.toLowerCase());
        
        // Skip very short names as they're often not meaningful
        if (cleanName.length < 3) return;
        
        // Skip system apps
        if (isSystemApp(cleanName)) return;

        // Prefer paths with actual executables
        if (!seen.has(cleanName) || 
            (app.path.toLowerCase().endsWith('.exe') && !seen.get(cleanName).path.toLowerCase().endsWith('.exe'))) {
            seen.set(cleanName, app);
        }
    });
    
    return Array.from(seen.values());
}

/**
 * Write detected apps to a log file
 */
function writeLogFile(apps) {
    let logContent = "Installed Apps Log\n===================\n";
    logContent += `Total Apps Found: ${apps.length}\n\n`;

    apps.forEach((app, index) => {
        logContent += `${index + 1}. ${app.name}\n   Path: ${app.path}\n\n`;
    });

    fs.writeFileSync(LOG_FILE_PATH, logContent, "utf-8");
    console.log(`🔍 Log written to ${LOG_FILE_PATH}`);
}

export { getInstalledApps };