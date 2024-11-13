// Globals
let folderHandle = null;
let folderPath = '';
let usernamesCSV = [];
let username = '';

// Check Browser Compatibility
function checkBrowserCompatibility() {
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    if (!isChrome) {
        alert('This app is only supported in Google Chrome. Please open the app in Chrome for full functionality.');
        document.body.innerHTML = '<h2 style="color: red; text-align: center;">Unsupported Browser</h2>';
        throw new Error('Unsupported browser detected. Please use Google Chrome.');
    }
}

// Welcome Screen
async function loadWelcomeScreen() {
    checkBrowserCompatibility();

    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <h2>Welcome to the Social Media Analysis App</h2>
        <input type="text" id="username" class="form-control" placeholder="Enter your username">
        <button id="check-profile-btn" class="btn btn-primary mt-3">Check Profile</button>
        <button id="select-folder-btn" class="btn btn-secondary mt-3 d-none">Select Data Folder</button>
        <button id="create-profile-btn" class="btn btn-success mt-3 d-none">Create Profile</button>
        <button id="open-data-btn" class="btn btn-secondary mt-3 d-none">Open Data</button>
        <div id="status-message" class="mt-3"></div>
    `;

    // Event listeners
    document.getElementById('check-profile-btn').addEventListener('click', checkUserProfile);
    document.getElementById('select-folder-btn').addEventListener('click', selectDataFolder);
    document.getElementById('create-profile-btn').addEventListener('click', createProfile);
    document.getElementById('open-data-btn').addEventListener('click', openDataTab);
}

// Check User Profile
async function checkUserProfile() {
    username = document.getElementById('username').value.trim();

    if (!username) {
        alert('Please enter a valid username.');
        return;
    }

    alert('New user detected. Please select the data folder.');
    document.getElementById('select-folder-btn').classList.remove('d-none');
}

// Select Data Folder
async function selectDataFolder() {
    try {
        folderHandle = await window.showDirectoryPicker();
        folderPath = folderHandle.name;
        document.getElementById('status-message').innerText = `Folder selected: ${folderPath}`;
        document.getElementById('create-profile-btn').classList.remove('d-none');
    } catch (error) {
        console.error('Error selecting folder:', error);
        alert('Folder selection was cancelled. Please try again.');
    }
}

// Create Profile
async function createProfile() {
    if (!username || !folderPath) {
        alert('Please enter a username and select a folder first.');
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
    await saveUsernamesCSV();

    // Create user data folder in the selected local folder
    await createUserDataFolder();

    alert('New user created.');
    document.getElementById('create-profile-btn').classList.add('d-none');
    document.getElementById('open-data-btn').classList.remove('d-none');
}

// Save `usernames.csv` in the App's Data Folder
async function saveUsernamesCSV() {
    try {
        const appDataFolder = await window.showDirectoryPicker({ startIn: 'data' });
        const fileHandle = await appDataFolder.getFileHandle('usernames.csv', { create: true });
        const writable = await fileHandle.createWritable();
        const csvContent = Papa.parse(usernamesCSV, { header: true, skipEmptyLines: true }).data;
        await writable.write(csvContent);
        await writable.close();
    } catch (error
