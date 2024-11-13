// Globals
let folderHandle = null;
let folderPath = '';

// Welcome Screen
async function loadWelcomeScreen() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <h2>Welcome to the Social Media Analysis App</h2>
        <input type="text" id="username" class="form-control" placeholder="Enter your username">
        <button id="check-profile-btn" class="btn btn-primary mt-3">Check Profile</button>
        <input type="file" id="file-input" class="form-control d-none" webkitdirectory directory multiple>
        <div id="status-message" class="mt-3"></div>
    `;

    // Event listener for checking the profile
    document.getElementById('check-profile-btn').addEventListener('click', checkUserProfile);
}

// Check User Profile after entering the username
async function checkUserProfile() {
    const username = document.getElementById('username').value.trim();

    if (!username) {
        alert('Please enter a valid username.');
        return;
    }

    alert(`Username entered: ${username}. Now please select a data folder.`);
    await selectDataFolder();
}

// Select Data Folder Automatically Based on Browser Support
async function selectDataFolder() {
    if (window.showDirectoryPicker) {
        // Modern API is supported (Chrome/Edge)
        try {
            folderHandle = await window.showDirectoryPicker();
            folderPath = folderHandle.name;
            document.getElementById('status-message').innerText = `Folder selected: ${folderPath}`;
        } catch (error) {
            console.error('Folder selection cancelled:', error);
            alert('Folder selection was cancelled. Please try again.');
        }
    } else {
        // Fallback for unsupported browsers (e.g., Firefox)
        document.getElementById('file-input').classList.remove('d-none');
        document.getElementById('file-input').addEventListener('change', handleFileInput);
    }
}

// Handle File Input Fallback
function handleFileInput(event) {
    const files = event.target.files;
    if (files.length > 0) {
        folderPath = files[0].webkitRelativePath.split('/')[0];
        document.getElementById('status-message').innerText = `Folder selected: ${folderPath}`;
    } else {
        alert('No files selected. Please try again.');
    }
}
