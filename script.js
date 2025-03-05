document.addEventListener("DOMContentLoaded", () => {
    console.log("Web App Loaded");

    const pickDirectoryButton = document.getElementById("pick-directory");
    const findInstalledAppsButton = document.getElementById("find-installed-apps");
    const fileListContainer = document.getElementById("file-list-container");
    const installedAppsContainer = document.getElementById("installed-apps-container");

    // Check if File System API is supported
    if (!window.showDirectoryPicker) {
        console.warn("File System Access API is NOT supported.");
        pickDirectoryButton.disabled = true;
        pickDirectoryButton.textContent = "Not Supported (Use Chrome/Edge)";
    }

    // Handle directory selection
    pickDirectoryButton.addEventListener("click", async () => {
        try {
            console.log("User clicked Pick Directory");

            const dirHandle = await window.showDirectoryPicker();
            fileListContainer.innerHTML = "";

            for await (const entry of dirHandle.values()) {
                const appName = entry.name.replace(/\.[^/.]+$/, ""); // Remove file extensions
                const item = document.createElement("div");
                item.className = "file-item";

                const name = document.createElement("span");
                name.textContent = `App: ${appName}`;

                const privacyScore = document.createElement("span");
                privacyScore.className = "privacy-score";

                try {
                    // Fetch privacy score from backend
                    const response = await fetch(`http://localhost:5001/api/privacy-score/${appName}`);
                    const data = await response.json();

                    privacyScore.textContent = data.score
                        ? `Privacy Score: ${data.score}`
                        : `Privacy Score: Not Available`;
                } catch (err) {
                    privacyScore.textContent = `Privacy Score: Error`;
                }

                item.appendChild(name);
                item.appendChild(privacyScore);
                fileListContainer.appendChild(item);
            }
        } catch (error) {
            console.error("Error accessing directory:", error);
            fileListContainer.textContent = `Error: ${error.message}`;
        }
    });

    // Handle fetching installed apps
    findInstalledAppsButton.addEventListener("click", async () => {
        console.log("User clicked Find Installed Apps");

        installedAppsContainer.innerHTML = "<p>Fetching installed apps...</p>";

        try {
            const response = await fetch("http://localhost:5001/api/privacy/installed-apps");
            const data = await response.json();

            installedAppsContainer.innerHTML = ""; // Clear previous results

            if (data.installedApps.length === 0) {
                installedAppsContainer.innerHTML = "<p>No installed apps found.</p>";
                return;
            }

            data.installedApps.forEach(app => {
                const item = document.createElement("div");
                item.className = "app-item";
                item.innerHTML = `<strong>${app.name}</strong> - <small>${app.path}</small>`;
                installedAppsContainer.appendChild(item);
            });

        } catch (error) {
            console.error("Error fetching installed apps:", error);
            installedAppsContainer.innerHTML = "<p>Failed to load installed applications.</p>";
        }
    });
});
