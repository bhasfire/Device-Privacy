import fs from "fs";
import path from "path";
import { exec } from "child_process";
import util from "util";
import { parseStringPromise } from "xml2js";
import crypto from "crypto";

const execPromise = util.promisify(exec);

// Cache to store already scanned apps
const permissionCache = new Map();

// Advanced list of permissions and their risk scores
const PERMISSION_MAPPING = {
    // High-risk permissions (score: 25 each)
    "userAccountInformation": { score: 25, description: "Access to user account details" },
    "contacts": { score: 25, description: "Access to contacts" },
    "appointments": { score: 25, description: "Access to calendar appointments" },
    "phoneCall": { score: 25, description: "Can make phone calls" },
    "webcam": { score: 25, description: "Access to camera/webcam" },
    "microphone": { score: 25, description: "Access to microphone" },
    "location": { score: 25, description: "Access to precise location" },
    "bluetooth": { score: 25, description: "Access to Bluetooth" },
    "backgroundMediaPlayback": { score: 20, description: "Background media access" },
    "radios": { score: 20, description: "Access to device radios" },
    
    // Medium-risk permissions (score: 15-20 each)
    "picturesLibrary": { score: 15, description: "Access to photos library" },
    "videosLibrary": { score: 15, description: "Access to videos library" },
    "musicLibrary": { score: 15, description: "Access to music library" },
    "documentsLibrary": { score: 15, description: "Access to documents" },
    "internetClient": { score: 15, description: "Can access the internet" },
    "privateNetworkClientServer": { score: 15, description: "Network access (private)" },
    "removableStorage": { score: 15, description: "Access to removable storage" },
    "enterpriseAuthentication": { score: 20, description: "Enterprise authentication" },
    "sharedUserCertificates": { score: 20, description: "Access to user certificates" },
    
    // Lower-risk permissions (score: 5-10 each)
    "backgroundTasks": { score: 10, description: "Run in background" },
    "blockedChatMessages": { score: 10, description: "Access to messaging" },
    "chat": { score: 10, description: "Access to chat" },
    "userNotificationListener": { score: 10, description: "Access to notifications" },
    "phoneCallHistoryPublic": { score: 20, description: "Access to call history" },
    "objects3D": { score: 5, description: "Access to 3D objects" },
    "codedUITestPattern": { score: 5, description: "UI testing capabilities" }
};

// DLL imports that suggest specific permissions or behaviors
const DLL_PERMISSION_MAPPING = {
    // Network and Internet
    "wininet.dll": { score: 15, permission: "internetClient", description: "Internet access" },
    "ws2_32.dll": { score: 15, permission: "networkAccess", description: "Network communication" },
    "urlmon.dll": { score: 15, permission: "internetContent", description: "Internet content" },
    "winhttp.dll": { score: 15, permission: "httpClient", description: "HTTP client capabilities" },
    
    // System Access
    "advapi32.dll": { score: 15, permission: "systemRegistry", description: "Registry access" },
    "kernel32.dll": { score: 5, permission: "systemKernel", description: "System kernel access" },
    "ntdll.dll": { score: 10, permission: "lowLevelSystem", description: "Low-level system access" },
    "secur32.dll": { score: 15, permission: "securityServices", description: "Security services" },
    
    // User Interface
    "user32.dll": { score: 10, permission: "userInterface", description: "UI manipulation" },
    "shell32.dll": { score: 10, permission: "shellAccess", description: "Shell/Explorer integration" },
    "gdi32.dll": { score: 5, permission: "graphicsDevice", description: "Graphics device access" },
    
    // Devices and Hardware
    "wlanapi.dll": { score: 15, permission: "wifiControl", description: "WiFi network access" },
    "bthprops.dll": { score: 20, permission: "bluetoothAccess", description: "Bluetooth access" },
    "setupapi.dll": { score: 15, permission: "deviceSetup", description: "Device setup access" },
    "portabledeviceapi.dll": { score: 15, permission: "portableDevices", description: "Access to portable devices" },
    
    // Multimedia
    "avrt.dll": { score: 15, permission: "audioVideo", description: "Audio/Video capabilities" },
    "dsound.dll": { score: 10, permission: "directSound", description: "Sound access" },
    "mfplat.dll": { score: 10, permission: "mediaFoundation", description: "Media access" },
    "wmvcore.dll": { score: 10, permission: "windowsMedia", description: "Media playback" },
    
    // Identity and Cryptography
    "wintrust.dll": { score: 10, permission: "securityVerification", description: "Security verification" },
    "crypt32.dll": { score: 15, permission: "cryptography", description: "Cryptography access" },
    "ncrypt.dll": { score: 15, permission: "cryptoAPI", description: "Crypto API access" },
    "winscard.dll": { score: 20, permission: "smartCardAccess", description: "Smart card access" },
    
    // Monitoring and Input
    "wtsapi32.dll": { score: 15, permission: "terminalServices", description: "Terminal services access" },
    "winmm.dll": { score: 10, permission: "multimediaTimer", description: "High-precision timing" },
    "rawinput.dll": { score: 15, permission: "rawInputDevices", description: "Raw input devices access" },
    
    // File Access
    "cabinet.dll": { score: 10, permission: "compressedFiles", description: "Compressed file access" },
    "shlwapi.dll": { score: 5, permission: "shellUtility", description: "Shell utility functions" },
    
    // Other
    "iphlpapi.dll": { score: 10, permission: "networkInfo", description: "Network information access" },
    "msi.dll": { score: 15, permission: "installer", description: "Installation capabilities" },
    "dbghelp.dll": { score: 10, permission: "debugging", description: "Debugging capabilities" },
    "bcrypt.dll": { score: 10, permission: "cryptoServices", description: "Cryptographic services" }
};

/**
 * Main function to get permission score for an application
 */
async function getPermissionScore(appPath) {
    try {
        if (!fs.existsSync(appPath)) {
            console.error(`Path does not exist: ${appPath}`);
            return { score: 0, permissions: ["Unknown (Path not found)"] };
        }
        
        // Check if we've already analyzed this app (cache hit)
        const cacheKey = generateCacheKey(appPath);
        if (permissionCache.has(cacheKey)) {
            console.log(`Using cached permission data for: ${appPath}`);
            return permissionCache.get(cacheKey);
        }
        
        const stats = fs.statSync(appPath);
        let targetPath = appPath;
        
        // If it's a directory, look for executable or manifest
        if (stats.isDirectory()) {
            targetPath = findMainExecutableInDir(appPath) || appPath;
        }
        
        const appType = determineAppType(targetPath);
        console.log(`Analyzing ${appType} app: ${path.basename(targetPath)}`);

        // Get permission data based on app type
        let permissionData;
        
        switch (appType) {
            case "UWP":
                permissionData = await scanUwpPermissions(targetPath);
                break;
            case "EXE":
                permissionData = await scanExePermissions(targetPath);
                break;
            case "MSI":
                permissionData = await scanMsiPermissions(targetPath);
                break;
            default:
                permissionData = { 
                    score: 0, 
                    permissions: ["Unknown (Unsupported app type)"] 
                };
        }
        
        // Cache the results
        permissionCache.set(cacheKey, permissionData);
        
        return permissionData;
    } catch (error) {
        console.error(`Error scanning permissions for ${appPath}:`, error);
        return { score: 0, permissions: ["Error scanning permissions"] };
    }
}

/**
 * Generate a cache key for an app path
 */
function generateCacheKey(appPath) {
    return crypto.createHash('md5').update(appPath).digest('hex');
}

/**
 * Find the main executable file in a directory
 */
function findMainExecutableInDir(dirPath) {
    try {
        if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
            return null;
        }
        
        const files = fs.readdirSync(dirPath);
        
        // First, look for a manifest file
        const manifestFile = files.find(file => 
            file.toLowerCase() === 'appxmanifest.xml' || 
            file.toLowerCase() === 'manifest.xml'
        );
        
        if (manifestFile) {
            return path.join(dirPath, manifestFile);
        }
        
        // Next, look for an exe file with the same name as the directory
        const dirName = path.basename(dirPath);
        const matchingExe = files.find(file => 
            file.toLowerCase() === `${dirName.toLowerCase()}.exe`
        );
        
        if (matchingExe) {
            return path.join(dirPath, matchingExe);
        }
        
        // Otherwise, return the first exe file found
        const exeFile = files.find(file => file.toLowerCase().endsWith('.exe'));
        
        if (exeFile) {
            return path.join(dirPath, exeFile);
        }
        
        return null;
    } catch (error) {
        console.error(`Error finding executable in ${dirPath}:`, error);
        return null;
    }
}

/**
 * Determine application type based on its path or extension
 */
function determineAppType(appPath) {
    if (appPath.includes("WindowsApps") || 
        appPath.toLowerCase().includes("appxmanifest.xml") || 
        appPath.toLowerCase().includes("manifest.xml")) {
        return "UWP";
    }
    
    if (appPath.toLowerCase().endsWith(".exe")) {
        return "EXE";
    }
    
    if (appPath.toLowerCase().endsWith(".msi")) {
        return "MSI";
    }
    
    // Try to determine by looking for manifest files
    try {
        const dir = fs.statSync(appPath).isDirectory() ? appPath : path.dirname(appPath);
        
        if (fs.existsSync(path.join(dir, "AppxManifest.xml")) || 
            fs.existsSync(path.join(dir, "manifest.xml"))) {
            return "UWP";
        }
    } catch (error) {
        // Ignore errors
    }
    
    return "UNKNOWN";
}

/**
 * Scan permissions for UWP applications by parsing the AppxManifest.xml
 */
async function scanUwpPermissions(appPath) {
    try {
        // Find manifest file
        let manifestPath = appPath;
        
        if (!appPath.toLowerCase().endsWith('.xml')) {
            const dir = fs.statSync(appPath).isDirectory() ? appPath : path.dirname(appPath);
            
            // Check common manifest file locations
            const possibleManifestPaths = [
                path.join(dir, "AppxManifest.xml"),
                path.join(dir, "manifest.xml"),
                path.join(dir, "app", "AppxManifest.xml"),
                path.join(dir, "app", "manifest.xml")
            ];
            
            manifestPath = possibleManifestPaths.find(p => fs.existsSync(p));
            
            if (!manifestPath) {
                console.log(`No manifest found for ${appPath}. Searching subdirectories...`);
                manifestPath = await findManifestRecursively(dir);
                
                if (!manifestPath) {
                    return { 
                        score: 30, // Default medium-low risk for UWP apps without manifest
                        permissions: ["Unknown (No manifest found)"],
                        details: [{
                            name: "unknownUwp",
                            description: "UWP app with no discoverable manifest",
                            score: 30
                        }]
                    };
                }
            }
        }
        
        // Read and parse the manifest
        const manifestData = fs.readFileSync(manifestPath, "utf-8");
        const xml = await parseStringPromise(manifestData);
        
        // Extract capabilities
        const capabilities = [];
        const permissionDetails = [];
        
        // Check for regular capabilities
        if (xml.Package?.Capabilities?.[0]?.Capability) {
            xml.Package.Capabilities[0].Capability.forEach(cap => {
                const name = cap.$.Name;
                capabilities.push(name);
                
                const mapping = PERMISSION_MAPPING[name] || 
                               { score: 5, description: `Access to ${name}` };
                
                permissionDetails.push({
                    name,
                    description: mapping.description || `Access to ${name}`,
                    score: mapping.score || 5
                });
            });
        }
        
        // Check for device capabilities
        if (xml.Package?.Capabilities?.[0]?.DeviceCapability) {
            xml.Package.Capabilities[0].DeviceCapability.forEach(cap => {
                const name = cap.$.Name;
                capabilities.push(`device:${name}`);
                
                permissionDetails.push({
                    name: `device:${name}`,
                    description: `Access to device: ${name}`,
                    score: 20 // Device capabilities are generally higher risk
                });
            });
        }
        
        // Check for restricted capabilities (highest risk)
        const rescapNamespace = Object.keys(xml.Package?.Capabilities?.[0] || {})
            .find(key => key.includes('rescap'));
            
        if (rescapNamespace && xml.Package?.Capabilities?.[0]?.[rescapNamespace]?.Capability) {
            xml.Package.Capabilities[0][rescapNamespace].Capability.forEach(cap => {
                const name = cap.$.Name;
                capabilities.push(`restricted:${name}`);
                
                permissionDetails.push({
                    name: `restricted:${name}`,
                    description: `Restricted capability: ${name}`,
                    score: 30 // Restricted capabilities are highest risk
                });
            });
        }
        
        // Check for uap permissions (Windows 10 specific capabilities)
        const uapNamespace = Object.keys(xml.Package?.Capabilities?.[0] || {})
            .find(key => key.includes('uap'));
            
        if (uapNamespace && xml.Package?.Capabilities?.[0]?.[uapNamespace]?.Capability) {
            xml.Package.Capabilities[0][uapNamespace].Capability.forEach(cap => {
                const name = cap.$.Name;
                capabilities.push(`uap:${name}`);
                
                permissionDetails.push({
                    name: `uap:${name}`,
                    description: `UAP capability: ${name}`,
                    score: 15 // UAP capabilities are medium risk
                });
            });
        }
        
        // Calculate total score based on the permissions
        let totalScore = 0;
        permissionDetails.forEach(perm => {
            totalScore += perm.score;
        });
        
        // Cap the score at 100
        totalScore = Math.min(totalScore, 100);
        
        // If no permissions found, assign a baseline score
        if (capabilities.length === 0) {
            return { 
                score: 10, // Low risk for apps with no permissions
                permissions: ["No specific permissions"], 
                details: [{
                    name: "noPermissions",
                    description: "No specific permissions requested",
                    score: 10
                }] 
            };
        }
        
        return { 
            score: totalScore, 
            permissions: capabilities,
            details: permissionDetails
        };
    } catch (error) {
        console.error(`Error scanning UWP permissions for ${appPath}:`, error);
        return { 
            score: 20, 
            permissions: ["Error reading permissions"],
            details: [{
                name: "error",
                description: "Error reading permissions",
                score: 20
            }]
        };
    }
}

/**
 * Find a manifest file recursively in a directory tree
 */
async function findManifestRecursively(dirPath, maxDepth = 3, currentDepth = 0) {
    if (currentDepth > maxDepth) return null;
    
    try {
        const entries = fs.readdirSync(dirPath);
        
        // Check for manifest in current directory
        const manifestFile = entries.find(file => 
            file.toLowerCase() === 'appxmanifest.xml' || 
            file.toLowerCase() === 'manifest.xml'
        );
        
        if (manifestFile) {
            return path.join(dirPath, manifestFile);
        }
        
        // Check subdirectories
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry);
            
            if (fs.statSync(fullPath).isDirectory()) {
                const result = await findManifestRecursively(fullPath, maxDepth, currentDepth + 1);
                if (result) return result;
            }
        }
        
        return null;
    } catch (error) {
        console.error(`Error searching for manifest in ${dirPath}:`, error);
        return null;
    }
}

/**
 * Scan EXE files by checking imported DLLs
 */
async function scanExePermissions(exePath) {
    try {
        const importedDLLs = await getDllImports(exePath);
        
        if (!importedDLLs || importedDLLs.length === 0) {
            return { 
                score: 15, // Default low-medium risk for unknown executables
                permissions: ["Basic system access"],
                details: [{
                    name: "basicSystem",
                    description: "Basic system access",
                    score: 15
                }]
            };
        }
        
        let score = 0;
        const permissions = new Set();
        const permissionDetails = [];
        
        // Analyze each imported DLL
        importedDLLs.forEach(dll => {
            const lowerDll = String(dll).toLowerCase();
            
            // Check if this DLL indicates a permission
            const mapping = DLL_PERMISSION_MAPPING[lowerDll];
            
            if (mapping) {
                score += mapping.score;
                permissions.add(mapping.permission);
                
                permissionDetails.push({
                    name: mapping.permission,
                    description: mapping.description,
                    source: lowerDll,
                    score: mapping.score
                });
            }
        });
        
        // If no specific permissions were detected
        if (permissions.size === 0) {
            return { 
                score: 15, 
                permissions: ["Basic system access"],
                details: [{
                    name: "basicSystem",
                    description: "Basic system access",
                    score: 15
                }]
            };
        }
        
        return { 
            score: Math.min(score, 100), 
            permissions: Array.from(permissions),
            details: permissionDetails,
            dlls: importedDLLs
        };
    } catch (error) {
        console.error(`Error scanning EXE permissions for ${exePath}:`, error);
        return { 
            score: 20, 
            permissions: ["Error analyzing executable"],
            details: [{
                name: "error",
                description: "Error analyzing executable",
                score: 20
            }]
        };
    }
}

/**
 * Get the imported DLLs from an executable using PowerShell
 */
async function getDllImports(exePath) {
    try {
        const psCommand = `
        function Get-DllImports {
            param([string]$ExePath)
            
            $dllList = @()
            
            # Try method 1: Check DLLs in PE header
            try {
                $dllsFromHeader = [System.Diagnostics.FileVersionInfo]::GetVersionInfo("$ExePath").FileDescription
                if ($dllsFromHeader -match "\\.dll") {
                    $dllList += $dllsFromHeader -split " " | Where-Object { $_ -match "\\.dll" }
                }
            } catch {}
            
            # Try method 2: Use PowerShell to extract strings and find DLLs
            try {
                $bytes = [System.IO.File]::ReadAllBytes("$ExePath")
                $text = [System.Text.Encoding]::ASCII.GetString($bytes)
                $dllMatches = [regex]::Matches($text, "([a-zA-Z0-9_-]+\\.dll)")
                
                foreach ($match in $dllMatches) {
                    $dllList += $match.Value.ToLower()
                }
            } catch {}
            
            # Try method 3: Use external tools if available
            $dumpbinPath = "C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Community\\VC\\Tools\\MSVC\\14.29.30133\\bin\\Hostx64\\x64\\dumpbin.exe"
            $dependencyWalkerPath = "C:\\Program Files (x86)\\Dependency Walker\\depends.exe"
            
            if (Test-Path $dumpbinPath) {
                try {
                    $output = & $dumpbinPath /IMPORTS "$ExePath" 2>$null
                    foreach ($line in $output) {
                        if ($line -match "\\s([\\w]+\\.dll)") {
                            $dllList += $matches[1].ToLower()
                        }
                    }
                } catch {}
            }
            
            # Return unique DLLs
            return $dllList | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique
        }
        
        $dlls = Get-DllImports -ExePath "${exePath.replace(/\\/g, "\\\\")}"
        $dlls | ConvertTo-Json
        `;
        
        const { stdout } = await execPromise(`powershell -Command "${psCommand}"`);
        let importedDLLs = [];
        
        try {
            importedDLLs = JSON.parse(stdout.trim());
            
            // Ensure the result is an array
            if (!Array.isArray(importedDLLs)) {
                importedDLLs = [importedDLLs].filter(Boolean);
            }
        } catch (error) {
            console.error("Error parsing PowerShell output for DLL imports:", error);
            importedDLLs = [];
        }
        
        return importedDLLs;
    } catch (error) {
        console.error(`Error getting DLL imports for ${exePath}:`, error);
        return [];
    }
}

/**
 * Scan MSI installer files
 */
async function scanMsiPermissions(msiPath) {
    try {
        // Extract basic information about the MSI using PowerShell
        const psCommand = `
        function Get-MsiInfo {
            param([string]$MsiPath)
            
            $installer = New-Object -ComObject WindowsInstaller.Installer
            $database = $installer.GetType().InvokeMember("OpenDatabase", "InvokeMethod", $null, $installer, @($MsiPath, 0))
            
            # Get properties from Property table
            $query = "SELECT Property, Value FROM Property"
            $view = $database.GetType().InvokeMember("OpenView", "InvokeMethod", $null, $database, @($query))
            $view.GetType().InvokeMember("Execute", "InvokeMethod", $null, $view, $null)
            
            $properties = @{}
            
            do {
                $record = $view.GetType().InvokeMember("Fetch", "InvokeMethod", $null, $view, $null)
                if ($record -eq $null) { break }
                
                $property = $record.GetType().InvokeMember("StringData", "GetProperty", $null, $record, 1)
                $value = $record.GetType().InvokeMember("StringData", "GetProperty", $null, $record, 2)
                
                $properties[$property] = $value
            } while ($true)
            
            # Get custom actions from CustomAction table
            $query = "SELECT Action, Type FROM CustomAction"
            $view = $database.GetType().InvokeMember("OpenView", "InvokeMethod", $null, $database, @($query))
            $view.GetType().InvokeMember("Execute", "InvokeMethod", $null, $view, $null)
            
            $customActions = @()
            
            do {
                $record = $view.GetType().InvokeMember("Fetch", "InvokeMethod", $null, $view, $null)
                if ($record -eq $null) { break }
                
                $action = $record.GetType().InvokeMember("StringData", "GetProperty", $null, $record, 1)
                $type = $record.GetType().InvokeMember("StringData", "GetProperty", $null, $record, 2)
                
                $customActions += @{ "Action" = $action; "Type" = $type }
            } while ($true)
            
            return @{
                "Properties" = $properties;
                "CustomActions" = $customActions
            }
        }
        
        try {
            $msiInfo = Get-MsiInfo -MsiPath "${msiPath.replace(/\\/g, "\\\\")}"
            $msiInfo | ConvertTo-Json -Depth 3
        } catch {
            @{ "Error" = $_.Exception.Message } | ConvertTo-Json
        }
        `;
        
        const { stdout } = await execPromise(`powershell -Command "${psCommand}"`);
        let msiInfo;
        
        try {
            msiInfo = JSON.parse(stdout.trim());
        } catch (error) {
            console.error("Error parsing MSI info:", error);
            return { 
                score: 50, // Medium risk by default for MSI files
                permissions: ["Install software", "Write to disk", "Modify system"],
                details: [
                    { name: "install", description: "Can install software", score: 20 },
                    { name: "filesystem", description: "Can write to disk", score: 15 },
                    { name: "system", description: "Can modify system", score: 15 }
                ]
            };
        }
        
        if (msiInfo.Error) {
            console.error(`Error analyzing MSI: ${msiInfo.Error}`);
            return { 
                score: 50,
                permissions: ["Install software", "Write to disk", "Modify system"],
                details: [
                    { name: "install", description: "Can install software", score: 20 },
                    { name: "filesystem", description: "Can write to disk", score: 15 },
                    { name: "system", description: "Can modify system", score: 15 }
                ]
            };
        }
        
        // Analyze MSI permissions based on properties and custom actions
        const permissions = ["Install software", "Write to disk"];
        const details = [
            { name: "install", description: "Can install software", score: 20 },
            { name: "filesystem", description: "Can write to disk", score: 15 }
        ];
        
        let score = 35; // Base score for MSI files
        
        // Check for elevated privileges
        if (msiInfo.Properties?.ALLUSERS === "1") {
            permissions.push("System-wide installation");
            details.push({
                name: "systemWide",
                description: "Installs for all users (requires admin)",
                score: 15
            });
            score += 15;
        }
        
        // Check for suspicious custom actions
        if (msiInfo.CustomActions?.length > 0) {
            const hasPowerShellAction = msiInfo.CustomActions.some(ca => 
                ca.Action.toLowerCase().includes("powershell") || 
                ca.Action.toLowerCase().includes("script")
            );
            
            if (hasPowerShellAction) {
                permissions.push("Execute scripts");
                details.push({
                    name: "executeScripts",
                    description: "Can execute custom scripts",
                    score: 25
                });
                score += 25;
            }
            
            const hasRegistryAction = msiInfo.CustomActions.some(ca => 
                ca.Action.toLowerCase().includes("registry") || 
                ca.Action.toLowerCase().includes("reg")
            );
            
            if (hasRegistryAction) {
                permissions.push("Modify registry");
                details.push({
                    name: "modifyRegistry",
                    description: "Can modify Windows registry",
                    score: 15
                });
                score += 15;
            }
        }
        
        // Cap the score at 100
        score = Math.min(score, 100);
        
        return { 
            score,
            permissions,
            details,
            msiInfo
        };
    } catch (error) {
        console.error(`Error scanning MSI permissions for ${msiPath}:`, error);
        return { 
            score: 50, // Medium risk by default for MSI files
            permissions: ["Install software", "Write to disk", "Modify system"],
            details: [
                { name: "install", description: "Can install software", score: 20 },
                { name: "filesystem", description: "Can write to disk", score: 15 },
                { name: "system", description: "Can modify system", score: 15 }
            ]
        };
    }
}

export { getPermissionScore };