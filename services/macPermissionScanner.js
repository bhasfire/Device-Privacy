import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import util from "util";
import crypto from "crypto";

const execPromise = util.promisify(exec);

const permissionCache = new Map();

const MAC_PERMISSION_MAPPING = {
    // High-risk permissions
    "NSCameraUsageDescription": { score: 25, description: "Access to camera" },
    "NSMicrophoneUsageDescription": { score: 25, description: "Access to microphone" },
    "NSLocationAlwaysUsageDescription": { score: 25, description: "Access to location at all times" },
    "NSLocationWhenInUseUsageDescription": { score: 25, description: "Access to location when app is in use" },
    "NSContactsUsageDescription": { score: 25, description: "Access to contacts" },
    "NSCalendarsUsageDescription": { score: 25, description: "Access to calendars" },
    "NSRemindersUsageDescription": { score: 25, description: "Access to reminders" },
    "NSHomeKitUsageDescription": { score: 25, description: "Access to HomeKit accessories" },

    // Medium-risk permissions
    "NSPhotoLibraryUsageDescription": { score: 20, description: "Access to photo library" },
    "NSBluetoothAlwaysUsageDescription": { score: 20, description: "Access to Bluetooth" },
    "NSMotionUsageDescription": { score: 15, description: "Access to motion & fitness data" },
    "NSSpeechRecognitionUsageDescription": { score: 20, description: "Access to speech recognition" },
    "NSFaceIDUsageDescription": { score: 20, description: "Access to Face ID" },

    // Lower-risk permissions
    "NSUserTrackingUsageDescription": { score: 10, description: "App tracking capabilities" },
    "NSLocalNetworkUsageDescription": { score: 10, description: "Access to local network" },
    "NSSiriUsageDescription": { score: 10, description: "Access to Siri" },
    "NSDesktopFolderUsageDescription": { score: 10, description: "Access to Desktop folder" },
    "NSDocumentsFolderUsageDescription": { score: 10, description: "Access to Documents folder" },
    "NSDownloadsFolderUsageDescription": { score: 10, description: "Access to Downloads folder" }
};

export async function macGetPermissionScore(appPath) {
    try {
        try {
            await fs.access(appPath);
        } catch (error) {
            console.error(`Path does not exist: ${appPath}`);
            return { 
                score: 0, 
                permissions: ["Unknown (Path not found)"],
                details: [{
                    name: "error",
                    description: "Path not found",
                    score: 0
                }]
            };
        }

        const cacheKey = generateCacheKey(appPath);
        if (permissionCache.has(cacheKey)) {
            console.log(`Using cached permission data for: ${appPath}`);
            return permissionCache.get(cacheKey);
        }

        if (!appPath.endsWith('.app')) {
            console.error(`Not a Mac application bundle: ${appPath}`);
            return { 
                score: 0, 
                permissions: ["Unknown (Not a Mac application)"],
                details: [{
                    name: "error",
                    description: "Not a Mac application bundle (.app)",
                    score: 0
                }]
            };
        }

        const appPermissions = await getMacAppPermissions(appPath);

        if (appPermissions.error) {
            return { 
                score: 10, 
                permissions: [`Error: ${appPermissions.error}`],
                details: [{
                    name: "error",
                    description: appPermissions.error,
                    score: 10
                }]
            };
        }

        const permissionList = appPermissions.permissions.map(perm => perm.description);
        const detailsList = appPermissions.permissions.map(perm => ({
            name: perm.id,
            description: perm.description,
            score: perm.score
        }));


        const totalScore = appPermissions.totalScore ||
                            (detailsList.reduce((sum, detail) => sum + detail.score, 0));

        const result = {
            score: Math.min(totalScore, 100), // Cap at 100 like Windows version
            permissions: permissionList,
            details: detailsList,
            appInfo: appPermissions.appInfo || {},
            entitlements: appPermissions.entitlements || {}
        };

        permissionCache.set(cacheKey, result);

        return result;
    } catch (error) {
        console.error(`Error getting permission score for ${appPath}:`, error);
        return {
            score: 20,
            permissions: ["Error analyzing application"],
            details: [{
                name: "error",
                description: "Error analyzing application: " + error.message,
                score: 20
            }]
        };
    }
}

function generateCacheKey(appPath) {
    return crypto.createHash('md5').update(appPath).digest('hex');
}

export async function getMacAppPermissions(appPath) {
    try {

        if (!appPath.endsWith('.app')) {
            return { error: "Not a Mac application bundle (.app)" };
        }

        try {
            await fs.access(appPath);
        } catch (error) {
            return { error: "Application path does not exist" };
        }


        const infoPlistPath = path.join(appPath, "Contents", "Info.plist");
        const infoPlist = await getInfoPlist(infoPlistPath);

        if (!infoPlist) {
            return { 
                permissions: [],
                error: "Could not read Info.plist file"
            };
        }


        const permissionsFound = [];


        for (const [key, mapping] of Object.entries(MAC_PERMISSION_MAPPING)) {
            if (infoPlist[key]) {
                permissionsFound.push({
                    id: key,
                    name: key.replace('NS', '').replace('UsageDescription', ''),
                    description: mapping.description,
                    explanation: infoPlist[key], // The explanation text from the plist
                    score: mapping.score
                });
            }
        }

        const entitlements = await getAppEntitlements(appPath);

        const totalScore = permissionsFound.reduce((sum, perm) => sum + perm.score, 0);

        return {
            appInfo: {
                bundleId: infoPlist.CFBundleIdentifier || "Unknown",
                version: infoPlist.CFBundleShortVersionString || infoPlist.CFBundleVersion || "Unknown",
                name: infoPlist.CFBundleDisplayName || infoPlist.CFBundleName || path.basename(appPath, '.app')
            },
            permissions: permissionsFound,
            entitlements: entitlements || {},
            totalScore: Math.min(totalScore, 100), // Cap at 100
            permissionCount: permissionsFound.length
        };
    } catch (error) {
        console.error(`Error scanning permissions for ${appPath}:`, error);
        return { error: "Failed to analyze app permissions" };
    }
}

async function getInfoPlist(plistPath) {
    try {
        const { stdout } = await execPromise(`plutil -convert json -o - "${plistPath}"`);
        return JSON.parse(stdout);
    } catch (error) {
        console.error(`Error reading Info.plist at ${plistPath}:`, error);
        return null;
    }
}

async function getAppEntitlements(appPath) {
    try {
        // Get the main executable from the app bundle
        const executableName = await getMainExecutableName(appPath);

        if (!executableName) {
            return null;
        }

        const executablePath = path.join(appPath, "Contents", "MacOS", executableName);

        // Extract entitlements using codesign
        const { stdout } = await execPromise(`codesign -d --entitlements :- "${executablePath}"`);

        // If we got XML data, convert it to JSON
        if (stdout && stdout.includes('<?xml')) {
            try {
                // Write the XML to a temporary file
                const tempPlistPath = `/tmp/entitlements_${Date.now()}.plist`;
                await fs.writeFile(tempPlistPath, stdout);

                const { stdout: jsonOutput } = await execPromise(`plutil -convert json -o - "${tempPlistPath}"`);

                await fs.unlink(tempPlistPath).catch(() => {});

                return JSON.parse(jsonOutput);
            } catch (conversionError) {
                console.error('Error converting entitlements to JSON:', conversionError);
            }
        }

        return null;
    } catch (error) {
        // codesign might return an error if the app isn't signed
        return null;
    }
}

async function getMainExecutableName(appPath) {
    try {
        const infoPlistPath = path.join(appPath, "Contents", "Info.plist");
        const infoPlist = await getInfoPlist(infoPlistPath);
        
        if (infoPlist && infoPlist.CFBundleExecutable) {
            return infoPlist.CFBundleExecutable;
        }
        
        const macOSDir = path.join(appPath, "Contents", "MacOS");
        const files = await fs.readdir(macOSDir);
        
        if (files.length > 0) {
            return files[0];
        }
        
        return null;
    } catch (error) {
        console.error(`Error finding executable for ${appPath}:`, error);
        return null;
    }
}