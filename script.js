document.addEventListener('DOMContentLoaded', () => {
    console.log("Web App Loaded");

    const pickDirectoryButton = document.getElementById('pick-directory');
    const fileListContainer = document.getElementById('file-list-container');

    if (!window.showDirectoryPicker) {
        console.warn("File System Access API is NOT supported.");
        pickDirectoryButton.disabled = true;
        pickDirectoryButton.textContent = "Not Supported (Use Chrome/Edge)";
        return;
    }

    pickDirectoryButton.addEventListener('click', async () => {
        try {
            console.log("User clicked Pick Directory");

            const dirHandle = await window.showDirectoryPicker();
            fileListContainer.innerHTML = '';

            for await (const entry of dirHandle.values()) {
                const appName = entry.name.replace(/\.[^/.]+$/, ""); // Remove file extensions
                const item = document.createElement('div');
                item.className = 'file-item';

                const name = document.createElement('span');
                name.textContent = `App: ${appName}`;

                const privacyScore = document.createElement('span');
                privacyScore.className = 'privacy-score';

                try {
                    // Fetch real score from backend
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
            console.error('Error accessing directory:', error);
            fileListContainer.textContent = `Error: ${error.message}`;
        }
    });
});
