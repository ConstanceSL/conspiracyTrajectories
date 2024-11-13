// Globals
let folderHandle = null;
let usernamesCSV = [];
let currentProfile = null;

// Welcome Screen
async function loadWelcomeScreen() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <h2>Welcome to the Social Media Analysis App</h2>
        <input type="text" id="username" class="form-control" placeholder="Enter your username">
        <button id="select-folder-btn" class="btn btn-secondary mt-3">Select Data Folder</button>
        <button id="check-profile-btn" class="btn btn-primary mt-3">Check Profile</button>
        <div id="status-message" class="mt-3"></div>
    `;

    document.getElementById('select-folder-btn').addEventListener('click', selectDataFolder);
    document.getElementById('check-profile-btn').addEventListener('click', checkUserProfile);
}

// Select Data Folder using File System Access API
async function selectDataFolder() {
    try {
        folderHandle = await window.showDirectoryPicker();
        document.getElementById('status-message').innerText = `Folder selected: ${folderHandle.name}`;
    } catch (error) {
        console.error('Folder selection cancelled:', error);
        alert('Please select a valid folder to proceed.');
    }
}

// Check User Profile
async function checkUserProfile() {
    const username = document.getElementById('username').value;
    if (!folderHandle) {
        alert('Please select a data folder first.');
        return;
    }

    const profile = await loadUserProfile(username);
    if (profile) {
        navigateTo(loadFilesPreviewScreen);
    } else {
        alert('Profile not found. Please create a new profile.');
    }
}

// Load User Profile from usernames.csv
async function loadUserProfile(username) {
    const usernamesCSV = await loadCSVFile('usernames.csv');
    const lowerCaseUsername = username.toLowerCase();
    return usernamesCSV.find(profile => profile.username.toLowerCase() === lowerCaseUsername) || null;
}

// Load a CSV File from the Selected Folder
async function loadCSVFile(fileName) {
    try {
        const fileHandle = await folderHandle.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        const text = await file.text();
        return Papa.parse(text, { header: true }).data;
    } catch (error) {
        console.error(`Error loading ${fileName}:`, error);
        alert(`Failed to load ${fileName}. Please check the folder contents.`);
        return [];
    }
}
