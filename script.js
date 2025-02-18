document.addEventListener('DOMContentLoaded', () => {
    console.log("Web App Loaded");

    const pickDirectoryButton = document.getElementById('pick-directory');
    const fileListContainer = document.getElementById('file-list-container');

    // Check if File System Access API is supported
    if (!window.showDirectoryPicker) {
        console.warn("File System Access API is NOT supported in this browser.");
        pickDirectoryButton.disabled = true;
        pickDirectoryButton.textContent = "Not Supported (Use Chrome/Edge)";
        return;
    }

    pickDirectoryButton.addEventListener('click', async () => {
        try {
            console.log("📂 User clicked Pick Directory button");

            // Open the directory picker
            const dirHandle = await window.showDirectoryPicker();
            fileListContainer.innerHTML = '';

            // Iterate through files in directory
            for await (const entry of dirHandle.values()) {
                const item = document.createElement('div');
                item.className = 'file-item';

                // Entry name (file or directory)
                const name = document.createElement('span');
                name.textContent = entry.kind === 'file' ? `File: ${entry.name}` : `Directory: ${entry.name}`;

                // Random Privacy Score
                const privacyScore = document.createElement('span');
                privacyScore.className = 'privacy-score';
                privacyScore.textContent = `Privacy Score: ${Math.floor(Math.random() * 101)}`;

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
