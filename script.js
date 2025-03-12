document.addEventListener("DOMContentLoaded", () => {
    console.log("DevicePrivacy Web App Loaded");

    // UI Elements
    const findInstalledAppsButton = document.getElementById("find-installed-apps");
    const findInstalledAppsMacButton = document.getElementById("find-installed-apps-mac");
    const installedAppsContainer = document.getElementById("installed-apps-container");
    const appSearchInput = document.getElementById("app-search");
    const riskFilterSelect = document.getElementById("risk-filter");
    const totalCountElement = document.getElementById("total-count");
    const loadingSpinner = document.getElementById("loading-spinner");
    const privacyScoreSummary = document.getElementById("privacy-score-summary");
    
    // App data storage
    let allApps = [];
    let filteredApps = [];

    // Check if app is running on Windows or Mac
    const isWindows = navigator.userAgent.indexOf("Windows") !== -1;
    const isMac = navigator.userAgent.indexOf("Mac") !== -1;
    
    // Show/hide appropriate buttons based on OS
    if (findInstalledAppsButton) {
        findInstalledAppsButton.style.display = isWindows ? "inline-block" : "none";
    }
    
    if (findInstalledAppsMacButton) {
        findInstalledAppsMacButton.style.display = isMac ? "inline-block" : "none";
    }
    
    // Show appropriate warning for non-supported platforms
    if (!isWindows && !isMac) {
        showWarning("This app is optimized for Windows and macOS. Some features may not work on other platforms.");
    }

    // Handle finding installed apps on Windows
    if (findInstalledAppsButton) {
        findInstalledAppsButton.addEventListener("click", async () => {
            await scanInstalledApps("windows");
        });
    }
    
    // Handle finding installed apps on Mac
    if (findInstalledAppsMacButton) {
        findInstalledAppsMacButton.addEventListener("click", async () => {
            await scanInstalledApps("mac");
        });
    }
    
    // Shared app scanning function with platform parameter
    async function scanInstalledApps(platform) {
        showLoading(true);
        clearAppList();
        showMessage(`Scanning for installed applications on ${platform}...`);
        
        try {
            // Use platform-specific endpoint
            const endpoint = platform === "mac" 
                ? "http://localhost:5001/api/privacy/installed-apps-mac"
                : "http://localhost:5001/api/privacy/installed-apps";
                
            const response = await fetch(endpoint);
            const data = await response.json();
            
            if (!data.installedApps || data.installedApps.length === 0) {
                showMessage(`No installed apps found on ${platform}. Please make sure you're running the server with appropriate privileges.`);
                showLoading(false);
                return;
            }
            
            allApps = data.installedApps;
            filteredApps = [...allApps];
            
            // Show total count
            updateTotalCount(allApps.length);
            showMessage(`Found ${allApps.length} installed applications. Analyzing permissions...`);
            
            // Process apps in batches to avoid UI freezing
            await processAppsInBatches(allApps, 10, platform);
            
            // Update privacy score summary after all apps are processed
            updatePrivacyScoreSummary();
            
            // Show message about completion
            showMessage(`Analysis complete! Showing ${filteredApps.length} applications.`);
        } catch (error) {
            console.error(`Error fetching installed apps for ${platform}:`, error);
            showMessage(`Failed to load installed applications for ${platform}. Is the server running?`);
        }
        
        showLoading(false);
    }
    
    // Search functionality
    if (appSearchInput) {
        appSearchInput.addEventListener("input", () => {
            filterApps();
        });
    }
    
    // Risk filter functionality
    if (riskFilterSelect) {
        riskFilterSelect.addEventListener("change", () => {
            filterApps();
        });
    }
    
    // Process apps in batches to avoid UI freezing
    async function processAppsInBatches(apps, batchSize, platform) {
        const totalApps = apps.length;
        let processedCount = 0;
        
        // Process in batches
        for (let i = 0; i < totalApps; i += batchSize) {
            const batch = apps.slice(i, i + batchSize);
            
            // Process each app in the batch
            const promises = batch.map(app => processApp(app, platform));
            await Promise.all(promises);
            
            processedCount += batch.length;
            showMessage(`Analyzing permissions... (${processedCount}/${totalApps})`);
            
            // Small delay to let UI update
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
    
    // Process a single app - fetch permissions and create UI element
    async function processApp(app, platform) {
        try {
            // Use platform-specific endpoint for permissions if needed
            const baseEndpoint = platform === "mac" 
                ? "http://localhost:5001/api/privacy/permissions-mac/"
                : "http://localhost:5001/api/privacy/permissions/";
                
            const permissionsResponse = await fetch(
                `${baseEndpoint}${encodeURIComponent(app.path)}`
            );
            const permissionsData = await permissionsResponse.json();
            
            // Store permission data with the app
            app.permissions = permissionsData.permissions || [];
            app.privacyScore = permissionsData.score || 0;
            app.permissionDetails = permissionsData.details || [];
            
            // Create and add UI element
            const appElement = createAppElement(app);
            installedAppsContainer.appendChild(appElement);
            
            return app;
        } catch (error) {
            console.error(`Error processing app ${app.name}:`, error);
            return app;
        }
    }
    
    // Create UI element for an app
    function createAppElement(app) {
        const item = document.createElement("div");
        item.className = "app-item";
        
        // Determine risk level class
        let riskClass = "";
        let riskLevel = "";
        
        if (app.privacyScore >= 61) {
            riskClass = "high-risk";
            riskLevel = "High";
        } else if (app.privacyScore >= 31) {
            riskClass = "medium-risk";
            riskLevel = "Medium";
        } else {
            riskClass = "low-risk";
            riskLevel = "Low";
        }
        
        item.classList.add(riskClass);
        
        // Create header with app name and risk indicator
        const header = document.createElement("div");
        header.className = "app-header";
        
        const nameElement = document.createElement("h3");
        nameElement.textContent = app.name;
        
        const scoreElement = document.createElement("div");
        scoreElement.className = `privacy-score ${riskClass}`;
        scoreElement.textContent = `${app.privacyScore}`;
        scoreElement.title = `Privacy Risk: ${riskLevel}`;
        
        header.appendChild(nameElement);
        header.appendChild(scoreElement);
        item.appendChild(header);
        
        // App info section
        const infoElement = document.createElement("div");
        infoElement.className = "app-info";
        infoElement.innerHTML = `<small>${app.path}</small>`;
        item.appendChild(infoElement);
        
        // Permissions section
        if (app.permissions && app.permissions.length > 0) {
            const permissionsElement = document.createElement("div");
            permissionsElement.className = "permissions-list";
            
            const permTitle = document.createElement("h4");
            permTitle.textContent = "Permissions:";
            permissionsElement.appendChild(permTitle);
            
            const permList = document.createElement("ul");
            
            app.permissions.forEach(permission => {
                const permItem = document.createElement("li");
                
                // Find permission details if available
                const details = app.permissionDetails?.find(d => d.name === permission);
                
                if (details) {
                    permItem.textContent = `${details.description} (${permission})`;
                    
                    // Add risk indicator based on score
                    if (details.score >= 20) {
                        permItem.classList.add("high-risk-permission");
                    } else if (details.score >= 10) {
                        permItem.classList.add("medium-risk-permission");
                    }
                } else {
                    permItem.textContent = permission;
                }
                
                permList.appendChild(permItem);
            });
            
            permissionsElement.appendChild(permList);
            item.appendChild(permissionsElement);
        } else {
            const noPermissions = document.createElement("p");
            noPermissions.className = "no-permissions";
            noPermissions.textContent = "No specific permissions detected";
            item.appendChild(noPermissions);
        }
        
        return item;
    }
    
    // Filter apps based on search term and risk level
    function filterApps() {
        // Clear current list
        clearAppList();
        
        const searchTerm = appSearchInput ? appSearchInput.value.toLowerCase() : "";
        const riskFilter = riskFilterSelect ? riskFilterSelect.value : "all";
        
        // Filter by search term and risk level
        filteredApps = allApps.filter(app => {
            // Filter by search term
            const matchesSearch = app.name.toLowerCase().includes(searchTerm) ||
                                 app.path.toLowerCase().includes(searchTerm);
            
            // Filter by risk level
            let matchesRisk = true;
            if (riskFilter === "high") {
                matchesRisk = app.privacyScore >= 61;
            } else if (riskFilter === "medium") {
                matchesRisk = app.privacyScore >= 31 && app.privacyScore <= 60;
            } else if (riskFilter === "low") {
                matchesRisk = app.privacyScore <= 30;
            }
            
            return matchesSearch && matchesRisk;
        });
        
        // Update count
        updateTotalCount(filteredApps.length);
        
        // Re-render filtered apps
        filteredApps.forEach(app => {
            const appElement = createAppElement(app);
            installedAppsContainer.appendChild(appElement);
        });
    }
    
    // Update the privacy score summary
    function updatePrivacyScoreSummary() {
        if (!privacyScoreSummary) return;
        
        const highRiskCount = allApps.filter(app => app.privacyScore >= 61).length;
        const mediumRiskCount = allApps.filter(app => app.privacyScore >= 31 && app.privacyScore <= 60).length;
        const lowRiskCount = allApps.filter(app => app.privacyScore <= 30).length;
        
        // Create chart or summary
        privacyScoreSummary.innerHTML = `
            <div class="summary-counts">
                <div class="risk-count high-risk">
                    <span class="count">${highRiskCount}</span>
                    <span class="label">High Risk</span>
                </div>
                <div class="risk-count medium-risk">
                    <span class="count">${mediumRiskCount}</span>
                    <span class="label">Medium Risk</span>
                </div>
                <div class="risk-count low-risk">
                    <span class="count">${lowRiskCount}</span>
                    <span class="label">Low Risk</span>
                </div>
            </div>
        `;
    }
    
    // Helper functions
    function clearAppList() {
        installedAppsContainer.innerHTML = "";
    }
    
    function showMessage(message) {
        const messageElement = document.createElement("p");
        messageElement.className = "status-message";
        messageElement.textContent = message;
        
        // Remove any existing status messages
        const existingMessages = installedAppsContainer.querySelectorAll(".status-message");
        existingMessages.forEach(elem => elem.remove());
        
        installedAppsContainer.prepend(messageElement);
    }
    
    function showWarning(message) {
        const warningElement = document.createElement("div");
        warningElement.className = "warning-message";
        warningElement.textContent = message;
        
        installedAppsContainer.prepend(warningElement);
    }
    
    function updateTotalCount(count) {
        if (totalCountElement) {
            totalCountElement.textContent = `${count} applications`;
        }
    }
    
    function showLoading(isLoading) {
        if (loadingSpinner) {
            loadingSpinner.style.display = isLoading ? "block" : "none";
        }
        
        // Disable all buttons during loading
        if (findInstalledAppsButton) {
            findInstalledAppsButton.disabled = isLoading;
            findInstalledAppsButton.textContent = isLoading ? "Scanning..." : "Scan Windows Apps";
        }
        
        if (findInstalledAppsMacButton) {
            findInstalledAppsMacButton.disabled = isLoading;
            findInstalledAppsMacButton.textContent = isLoading ? "Scanning..." : "Scan Mac Apps";
        }
    }
});