// Globals
let folderHandle = null;
let folderPath = '';
let usernamesCSV = [];
let currentProfile = null;

// Welcome Screen
async function loadWelcomeScreen() {
    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <h2>Welcome to the Social Media Analysis App</h2>
        <input type="text" id="username" class="form-control" placeholder="Enter your username">
        <button id="check-profile-btn" class="btn btn-primary mt-3">Check Profile</button>
        <button id="select-folder-btn" class="btn btn-secondary mt-3 d-none">Select Data Folder</button>
        <button id="confirm-profile-btn" class="btn btn-success mt-3 d-none">Create/Confirm Profile</button>
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

    const profile = await loadUserProfile(username);

    if (profile) {
        alert(`Profile found for ${username}. Please select a data folder if you wish to update it.`);
        document.getElementById('select-folder-btn').classList.remove('d-none');
        document.getElementById('confirm-profile-btn').classList.remove('d-none');
        folderPath = profile.folderPath;
    } else {
        alert('Profile not found. Please enter a username and select a data folder to create a new profile.');
        document.getElementById('select-folder-btn').classList.remove('d-none');
        document.getElementById('confirm-profile-btn').classList.remove('d-none');
    }
}

// Select Data Folder using the File System Access API
async function selectDataFolder() {
    try {
        folderHandle = await window.showDirectoryPicker();
        folderPath = folderHandle.name;
        document.getElementById('status-message').innerText = `Folder selected: ${folderPath}`;
    } catch (error) {
        console.error('Folder selection cancelled:', error);
        alert('Folder selection was cancelled. Please select a valid folder.');
    }
}

// Confirm Profile Creation or Update
async function confirmProfile() {
    const username = document.getElementById('username').value.trim();

    if (!username) {
        alert('Please enter a valid username.');
        return;
    }

    if (!folderHandle) {
        alert('No folder selected. Please select a data folder before confirming the profile.');
        return;
    }

    const profileExists = await loadUserProfile(username);

    if (profileExists) {
        // Update existing profile
        profileExists.folderPath = folderPath;
        profileExists.dateLastUpdated = new Date().toISOString();
        alert('Profile updated successfully.');
    } else {
        // Create new profile
        await saveNewProfile(username);
    }

    navigateTo(loadFilesPreviewScreen);
}

// Load User Profile from usernames.csv
async function loadUserProfile(username) {
    const usernamesCSV = await loadCSVFile('usernames.csv');
    const lowerCaseUsername = username.toLowerCase();
    return usernamesCSV.find(profile => profile.username.toLowerCase() === lowerCaseUsername) || null;
}

// Save a New Profile
async function saveNewProfile(username) {
    const date = new Date().toISOString();
    const newProfile = {
        username,
        folderPath,
        dateCreated: date,
        dateLastUpdated: date,
    };

    usernamesCSV.push(newProfile);
    await saveCSVFile('usernames.csv', usernamesCSV);
    alert('New profile created and saved successfully.');
}
