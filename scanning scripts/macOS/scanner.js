#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const crypto = require('crypto');

const execPromise = util.promisify(exec);
const permissionCache = new Map();

// Mapping for macOS permissions (adapt as needed)
const MAC_PERMISSION_MAPPING = {
  "NSCameraUsageDescription": { score: 25, description: "Access to camera" },
  "NSMicrophoneUsageDescription": { score: 25, description: "Access to microphone" },
  "NSLocationAlwaysUsageDescription": { score: 25, description: "Access to location at all times" },
  "NSLocationWhenInUseUsageDescription": { score: 25, description: "Access to location when app is in use" },
  "NSContactsUsageDescription": { score: 25, description: "Access to contacts" },
  "NSCalendarsUsageDescription": { score: 25, description: "Access to calendars" },
  "NSRemindersUsageDescription": { score: 25, description: "Access to reminders" },
  "NSHomeKitUsageDescription": { score: 25, description: "Access to HomeKit accessories" },
  "NSPhotoLibraryUsageDescription": { score: 20, description: "Access to photo library" },
  "NSBluetoothAlwaysUsageDescription": { score: 20, description: "Access to Bluetooth" },
  "NSMotionUsageDescription": { score: 15, description: "Access to motion & fitness data" },
  "NSSpeechRecognitionUsageDescription": { score: 20, description: "Access to speech recognition" },
  "NSFaceIDUsageDescription": { score: 20, description: "Access to Face ID" },
  "NSUserTrackingUsageDescription": { score: 10, description: "App tracking capabilities" },
  "NSLocalNetworkUsageDescription": { score: 10, description: "Access to local network" },
  "NSSiriUsageDescription": { score: 10, description: "Access to Siri" },
  "NSDesktopFolderUsageDescription": { score: 10, description: "Access to Desktop folder" },
  "NSDocumentsFolderUsageDescription": { score: 10, description: "Access to Documents folder" },
  "NSDownloadsFolderUsageDescription": { score: 10, description: "Access to Downloads folder" }
};

function generateCacheKey(appPath) {
  return crypto.createHash('md5').update(appPath).digest('hex');
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
    const infoPlistPath = path.join(appPath, "Contents", "Info.plist");
    const infoPlist = await getInfoPlist(infoPlistPath);
    if (!infoPlist || !infoPlist.CFBundleExecutable) return null;
    const executablePath = path.join(appPath, "Contents", "MacOS", infoPlist.CFBundleExecutable);
    const { stdout } = await execPromise(`codesign -d --entitlements :- "${executablePath}"`);
    if (stdout && stdout.includes("<?xml")) {
      const tempPlistPath = `/tmp/entitlements_${Date.now()}.plist`;
      await fs.writeFile(tempPlistPath, stdout);
      const { stdout: jsonOutput } = await execPromise(`plutil -convert json -o - "${tempPlistPath}"`);
      await fs.unlink(tempPlistPath);
      return JSON.parse(jsonOutput);
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function getMacAppPermissions(appPath) {
  try {
    try {
      await fs.access(appPath);
    } catch {
      return { error: "Application path does not exist" };
    }
    if (!appPath.endsWith('.app')) {
      return { error: "Not a Mac application bundle (.app)" };
    }
    const infoPlistPath = path.join(appPath, "Contents", "Info.plist");
    const infoPlist = await getInfoPlist(infoPlistPath);
    if (!infoPlist) {
      return { error: "Could not read Info.plist file" };
    }
    let permissionsFound = [];
    for (const [key, mapping] of Object.entries(MAC_PERMISSION_MAPPING)) {
      if (infoPlist[key]) {
        permissionsFound.push({
          id: key,
          name: key.replace('NS', '').replace('UsageDescription', ''),
          description: mapping.description,
          explanation: infoPlist[key],
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
      totalScore: Math.min(totalScore, 100),
      permissionCount: permissionsFound.length
    };
  } catch (error) {
    return { error: "Failed to analyze app permissions" };
  }
}

async function macGetPermissionScore(appPath) {
  try {
    try {
      await fs.access(appPath);
    } catch {
      return {
        score: 0,
        permissions: ["Unknown (Path not found)"],
        details: [{ name: "error", description: "Path not found", score: 0 }]
      };
    }
    const cacheKey = generateCacheKey(appPath);
    if (permissionCache.has(cacheKey)) {
      console.log(`Using cached data for ${appPath}`);
      return permissionCache.get(cacheKey);
    }
    if (!appPath.endsWith('.app')) {
      return {
        score: 0,
        permissions: ["Unknown (Not a Mac application)"],
        details: [{ name: "error", description: "Not a Mac application bundle (.app)", score: 0 }]
      };
    }
    const appPermissions = await getMacAppPermissions(appPath);
    if (appPermissions.error) {
      return {
        score: 10,
        permissions: [`Error: ${appPermissions.error}`],
        details: [{ name: "error", description: appPermissions.error, score: 10 }]
      };
    }
    const permissionList = appPermissions.permissions.map(perm => perm.description);
    const detailsList = appPermissions.permissions.map(perm => ({
      name: perm.id,
      description: perm.description,
      score: perm.score
    }));
    const totalScore = appPermissions.totalScore;
    const result = {
      score: Math.min(totalScore, 100),
      permissions: permissionList,
      details: detailsList,
      appInfo: appPermissions.appInfo,
      entitlements: appPermissions.entitlements
    };
    permissionCache.set(cacheKey, result);
    return result;
  } catch (error) {
    return {
      score: 20,
      permissions: ["Error analyzing application"],
      details: [{ name: "error", description: "Error analyzing application: " + error.message, score: 20 }]
    };
  }
}

async function scanApplications(directory) {
  try {
    const files = await fs.readdir(directory);
    const appBundles = files.filter(file => file.endsWith('.app'));
    const results = [];
    for (const appBundle of appBundles) {
      const appPath = path.join(directory, appBundle);
      console.log(`Scanning: ${appPath}`);
      const result = await macGetPermissionScore(appPath);
      results.push(result);
    }
    return results;
  } catch (error) {
    console.error("Error scanning directory:", error);
    return [];
  }
}

async function main() {
  const appsDirectory = '/Applications'; // adjust if needed
  console.log(`Scanning applications in ${appsDirectory}...`);
  const scanResults = await scanApplications(appsDirectory);
  console.log("Scan complete. Results:");
  console.log(JSON.stringify(scanResults, null, 2));
}

main();
