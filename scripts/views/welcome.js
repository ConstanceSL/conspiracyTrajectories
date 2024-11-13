// Globals
let folderHandle = null;
let usersFolderHandle = null;
let selectedUser = '';
let usersList = [];

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
        <button id="select-data-folder-btn" class="btn btn-primary mt-3">Select Data Folder</button>
        <div id="user-selection" class="mt-3 d-none"></div>
        <div id="status-message" class="mt-3"></div>
        <button id="view-data-btn" class="btn btn-secondary mt-3 d-none">View Data</button>
    `;

    // Event listeners
    document.getElementById('select-data-folder-btn').addEventListener('click', selectDataFolder);
    document.getElementById('view-data-btn').addEventListener('click', openDataTab);
}

// Select Data Folder
async function selectDataFolder() {
    try {
        folderHandle = await window.showDirectoryPicker();
        document.getElementById('status-message').innerText = `Data folder selected: ${folderHandle.name}`;
        await loadUsersFolder();
    } catch (error) {
        console.error('Error selecting folder:', error);
        alert('Folder selection was cancelled. Please try again.');
    }
}

// Load Users Folder
async function loadUsersFolder() {
    try {
        usersFolderHandle = await folderHandle.getDirectoryHandle('Users', { create: true });
        console.log('Users folder accessed.');

        usersList = [];
        for await (const entry of usersFolderHandle.values()) {
            if (entry.kind === 'directory') {
                usersList.push(entry.name);
            }
        }

        displayUserSelection();
    } catch (error) {
        console.error('Error loading Users folder:', error);
        alert('The selected folder does not contain a "Users" subfolder. Please choose the correct folder.');
        await selectDataFolder();
    }
}

// Display User Selection
function displayUserSelection() {
    const userSelectionDiv = document.getElementById('user-selection');
    userSelectionDiv.innerHTML = `
        <h3>Select an Existing User or Create a New User</h3>
        <ul id="user-list"></ul>
        <button id="create-new-user-btn" class="btn btn-success mt-3">Create New User</button>
    `;
    userSelectionDiv.classList.remove('d-none');

    const userList = document.getElementById('user-list');

    // Check if the usersList is empty
    if (usersList.length === 0) {
        userList.innerHTML = '<li><em>No existing users found. Please create a new user.</em></li>';
    } else {
        userList.innerHTML = usersList.map(user => `<li><button class="btn btn-link user-btn" id="user-btn-${user}">${user}</button></li>`).join('');
    }

    // Event listeners for existing users
    document.querySelectorAll('.user-btn').forEach(btn => {
        btn.addEventListener('click', () => selectUser(btn.textContent));
    });

    // Event listener for creating a new user
    document.getElementById('create-new-user-btn').addEventListener('click', promptNewUser);
}

// Select an Existing User and Highlight It
function selectUser(username) {
    selectedUser = username;

    // Highlight the selected user
    document.querySelectorAll('.user-btn').forEach(btn => {
        btn.classList.remove('active-user');
    });
    const selectedButton = document.getElementById(`user-btn-${username}`);
    selectedButton.classList.add('active-user');

    // Show the "View Data" button without alert
    document.getElementById('view-data-btn').classList.remove('d-none');
}

// Prompt for New User Creation
async function promptNewUser() {
    const newUsername = prompt('Enter a new username:');
    if (!newUsername) {
        alert('Invalid username. Please try again.');
        return;
    }

    if (usersList.includes(newUsername)) {
        alert('Username already exists. Please choose a different name.');
        return;
    }

    await createNewUserFolder(newUsername);
}

// Create New User Folder
async function createNewUserFolder(username) {
    try {
        const userFolderHandle = await usersFolderHandle.getDirectoryHandle(username, { create: true });
        console.log(`User folder "${username}" created successfully.`);

        // Copy 'Data' folder into the new user folder
        await copyDataFolder(userFolderHandle, username);

        loadUsersFolder(); // Refresh the user list
    } catch (error) {
        console.error('Error creating new user folder:', error);
        alert('Failed to create new user folder.');
    }
}

// Open Data Tab
function openDataTab() {
    window.open('files-preview.html', '_blank');
}

// CSS for Highlighting Selected User
const style = document.createElement('style');
style.innerHTML = `
    .active-user {
        background-color: #007bff;
        color: white;
        font-weight: bold;
    }
`;
document.head.appendChild(style);

// Initialize the App
document.addEventListener('DOMContentLoaded', loadWelcomeScreen);
