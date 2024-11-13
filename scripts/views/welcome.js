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

    const profile = await loadUserProfile(username);

    if (profile) {
        const confirmSelection = confirm(`Profile found for ${username}. Do you want to select a data folder?`);
        if (confirmSelection) {
            await selectDataFolder();
            if (folderHandle) {
                navigateTo(loadFilesPreviewScreen);
            }
        }
    } else {
        const createProfile = confirm('Profile not found. Do you want to create a new profile?');
        if (createProfile) {
            await selectDataFolder();
            if (folderHandle) {
                await saveNewProfile(username);
            }
        }
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

// Load User Profile from usernames.csv
async function loadUserProfile(username) {
    const usernamesCSV = await loadCSVFile('usernames.csv');
    const lowerCaseUsername = username.toLowerCase();
    return usernamesCSV.find(profile => profile.username.toLowerCase() === lowerCaseUsername) || null;
}

// Save a New Profile
async function saveNewProfile(username) {
    if (!folderHandle) {
        alert('No folder selected. Please select a folder first.');
        return;
    }

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
