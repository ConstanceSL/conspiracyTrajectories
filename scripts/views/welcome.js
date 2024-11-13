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
        <button id="select-folder-btn" class="btn btn-secondary mt-3 d-none">Select Data Folder</button>
        <input type="file" id="file-input" class="form-control d-none" webkitdirectory directory multiple>
        <button id="confirm-profile-btn" class="btn btn-success mt-3 d-none">Confirm Profile</button>
        <div id="status-message" class="mt-3"></div>
    `;

    // Event listeners
    document.getElementById('check-profile-btn').addEventListener('click', checkUserProfile);
    document.getElementById('select-folder-btn').addEventListener('click', selectDataFolder);
    document.getElementById('confirm-profile-btn').addEventListener('click', confirmProfile);
}

// Check User Profile after entering the username
async function checkUserProfile() {
    const username = document.getElementById('username').value.trim();

    if (!username) {
        alert('Please enter a valid username.');
        return;
    }

    alert(`Username entered: ${username}. Please select a data folder.`);
    document.getElementById('select-folder-btn').classList.remove('d-none');
    document.getElementById('confirm-profile-btn').classList.remove('d-none');
}

// Select Data Folder with Fallback
async function selectDataFolder() {
    if (window.showDirectoryPicker) {
        // Modern API is supported
        try {
            folderHandle = await window.showDirectoryPicker();
            folderPath = folderHandle.name;
            document.getElementById('status-message').innerText = `Folder selected: ${folderPath}`;
        } catch (error) {
            console.error('Folder selection cancelled:', error);
            alert('Please select a valid folder.');
        }
    } else {
        // Fallback for browsers that do not support showDirectoryPicker (e.g., Firefox)
        alert('Your browser does not support folder selection. Please select a file from the data folder instead.');
        const fileInput = document.getElementById('file-input');
        fileInput.classList.remove('d-none');
        fileInput.addEventListener('change', handleFileInput);
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

// Confirm Profile Creation
function confirmProfile() {
    if (!folderPath) {
        alert('No folder selected. Please select a folder before confirming the profile.');
        return;
    }

    alert(`Profile confirmed with folder path: ${folderPath}`);
}
