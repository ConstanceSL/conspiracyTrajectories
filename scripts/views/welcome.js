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
    `;

    // Event listener
    document.getElementById('select-data-folder-btn').addEventListener('click', selectDataFolder);
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
        // Check if 'Users' folder exists, if not create it
        usersFolderHandle = await folderHandle.getDirectoryHandle('Users', { create: true });
        console.log('Users folder accessed.');

        // Read existing user folders
        usersList = [];
        for await (const entry of usersFolderHandle.values()) {
            if (entry.kind === 'directory') {
                usersList.push(entry.name);
            }
        }

        // Display user selection options
        displayUserSelection();
    } catch (error) {
        console.error('Error loading Users folder:', error);
        alert('Failed to access or create the Users folder.');
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

    // Populate user list
    const userList = document.getElementById('user-list');
    userList.innerHTML = usersList.map(user => `<li><button class="btn btn-link user-btn">${user}</button></li>`).join('');

    // Event listeners for existing users
    document.querySelectorAll('.user-btn').forEach(btn => {
        btn.addEventListener('click', () => selectUser(btn.textContent));
    });

    // Event listener for creating a new user
    document.getElementById('create-new-user-btn').addEventListener('click', promptNewUser);
}

// Select an Existing User
function selectUser(username) {
    selectedUser = username;
    alert(`User "${selectedUser}" selected.`);
    // Navigate to the next screen or load user data as needed
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

        // Create placeholder files in the new user folder
        const filesToCreate = ['notes.csv', 'annotations.csv', 'summary.txt'];
        for (const fileName of filesToCreate) {
            await createFile(userFolderHandle, fileName);
        }

        alert(`New user "${username}" created.`);
        loadUsersFolder(); // Refresh the user list
    } catch (error) {
        console.error('Error creating new user folder:', error);
        alert('Failed to create new user folder.');
    }
}

// Create a Single File in the User's Folder
async function createFile(folderHandle, fileName) {
    try {
        const fileHandle = await folderHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(`This is a placeholder for ${fileName}`);
        await writable.close();
        console.log(`${fileName} created successfully.`);
    } catch (error) {
        console.error(`Error creating ${fileName}:`, error);
        alert(`Failed to create ${fileName}.`);
    }
}

// Initialize the App
document.addEventListener('DOMContentLoaded', loadWelcomeScreen);
