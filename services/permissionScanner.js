const fs = require('fs');
const path = require('path');
const pe = require('pe-parser');

const PERMISSION_RISKS = {
    "advapi32.dll": 3, // High-risk: Access to registry & user privileges
    "user32.dll": 2,   // Medium-risk: UI control, keylogging potential
    "kernel32.dll": 1, // Low-risk: General system access
    "wininet.dll": 3,  // High-risk: Internet access
    "ws2_32.dll": 3,   // High-risk: Network access (sockets)
};

function getPermissionScore(appName) {
    return new Promise((resolve, reject) => {
        const exePath = path.join(__dirname, `../public/apps/${appName}.exe`);

        if (!fs.existsSync(exePath)) {
            return reject("Application not found.");
        }

        pe.parse(exePath, (err, data) => {
            if (err) return reject("Error parsing executable.");

            const importedDLLs = data.imports.map(entry => entry.dll.toLowerCase());
            let score = 0;

            importedDLLs.forEach(dll => {
                if (PERMISSION_RISKS[dll]) {
                    score += PERMISSION_RISKS[dll];
                }
            });

            // Normalize score (0-100)
            const normalizedScore = Math.min(Math.round((score / 9) * 100), 100);
            resolve(normalizedScore);
        });
    });
}

module.exports = { getPermissionScore };
