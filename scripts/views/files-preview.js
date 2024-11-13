// Files Preview Screen
async function loadFilesPreviewScreen() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <h2>Available Files for Analysis</h2>
        <button id="load-new-profile-btn" class="btn btn-secondary mb-3">Load New Profile</button>
        <ul id="files-list" class="list-group"></ul>
    `;

    const files = await listAvailableFiles();
    const filesList = document.getElementById('files-list');

    files.forEach(file => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item';
        listItem.textContent = file;
        listItem.addEventListener('click', () => openFileView(file));
        filesList.appendChild(listItem);
    });

    document.getElementById('load-new-profile-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to load a new profile? Unsaved changes will be lost.')) {
            navigateTo(loadWelcomeScreen);
        }
    });
}
