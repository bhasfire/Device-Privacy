import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { writeFileSync } from "fs";

const LOG_FILE_PATH = "installed_apps_log.txt";

// Promisify exec for cleaner async/await usage
const execAsync = promisify(exec);

/**
 * Get a list of installed applications on macOS
 * @returns {Promise<Array>} Array of objects containing app information
 */
export async function getMacInstalledApps() {
    try {
        console.log("Scanning for installed Mac applications...");
        // macOS applications are typically stored in these directories
        const applicationDirectories = [
            "/Applications",
            "/System/Applications",
            `${process.env.HOME}/Applications`
        ];
        
        let allApps = [];
        
        // Collect apps from each directory
        for (const appDir of applicationDirectories) {
            try {
                // Check if directory exists before attempting to read it
                await fs.access(appDir);
                
                // Find all .app bundles in the directory
                const { stdout } = await execAsync(`find "${appDir}" -name "*.app" -depth 1`);
                
                // Process each app path
                const appPaths = stdout.split('\n').filter(Boolean);
                
                for (const appPath of appPaths) {
                    try {
                        // Extract app name from path
                        const appName = path.basename(appPath, '.app');
                        
                        // Get app metadata using 'mdls' command
                        const { stdout: metadataOutput } = await execAsync(`mdls "${appPath}"`);
                        
                        // Read Info.plist if available to get more details
                        let version = "Unknown";
                        let bundleId = "Unknown";
                        
                        try {
                            const infoPlistPath = path.join(appPath, "Contents", "Info.plist");
                            const { stdout: plistOutput } = await execAsync(`plutil -convert json -o - "${infoPlistPath}"`);
                            const plistData = JSON.parse(plistOutput);
                            
                            version = plistData.CFBundleShortVersionString || plistData.CFBundleVersion || "Unknown";
                            bundleId = plistData.CFBundleIdentifier || "Unknown";
                        } catch (plistError) {
                            // Silently continue if Info.plist cannot be read
                        }
                        
                        allApps.push({
                            name: appName,
                            path: appPath,
                            version: version,
                            bundleId: bundleId
                        });
                    } catch (appError) {
                        console.error(`Error processing app ${appPath}:`, appError);
                    }
                }
            } catch (dirError) {
                // Directory may not exist on this system, which is fine
                console.log(`Directory ${appDir} not accessible or doesn't exist`);
            }
        }

        writeLogFile(allApps);

        return allApps;
    } catch (error) {
        console.error("Error scanning for Mac applications:", error);
        throw new Error("Failed to scan for Mac applications");
    }
}

function writeLogFile(apps) {
    let logContent = "Installed Apps Log\n===================\n";
    logContent += `Total Apps Found: ${apps.length}\n\n`;

    apps.forEach((app, index) => {
        logContent += `${index + 1}. ${app.name}\n   Path: ${app.path}\n\n`;
    });

    writeFileSync(LOG_FILE_PATH, logContent, "utf-8");
    console.log(`🔍 Log written to ${LOG_FILE_PATH}`);
}