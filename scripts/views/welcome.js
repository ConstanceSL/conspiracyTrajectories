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
        <div id="folder-instruction" class="mt-3 d-none">Please select the folder where the data is stored:</div>
        <input type="file" id="file-input" class="form-control d-none" webkitdirectory directory multiple>
        <button id="create-profile-btn" class="btn btn-success mt-3 d-none">Create Profile</button>
        <button id="open-data-btn" class="btn btn-secondary mt-3 d-none">Open Data</button>
        <div id="status-message" class="mt-3"></div>
    `;

    // Event listeners
    document.getElementById('check-profile-btn').addEventListener('click', checkUserProfile);
    document.getElementById('create-profile-btn').addEventListener('click', createProfile);
    document.getElementById('open-data-btn').addEventListener('click', openDataTab);
}

// Check User Profile after entering the username
async function checkUserProfile() {
    const username = document.getElementById('username').value.trim();

    if (!username) {
        alert('Please enter a valid username.');
        return;
    }

    document.getElementById('folder-instruction').classList.remove('d-none');
    await selectDataFolder();
}

// Select Data Folder with Fallback
async function selectDataFolder() {
    try {
        if (window.showDirectoryPicker) {
            // Use modern API if supported
            folderHandle = await window.showDirectoryPicker();
            folderPath = folderHandle.name;
            document.getElementById('status-message').innerText = `Folder selected: ${folderPath}`;
            document.getElementById('create-profile-btn').classList.remove('d-none');
        } else {
            // Fallback for unsupported browsers
            const fileInput = document.getElementById('file-input');
            fileInput.classList.remove('d-none');
            fileInput.addEventListener('change', handleFileInput);
        }
    } catch (error) {
        console.error('Error selecting folder:', error);
        alert('Folder selection was cancelled. Please try again.');
    }
}

// Handle File Input Fallback
function handleFileInput(event) {
    const files = event.target.files;
    if (files.length > 0) {
        folderPath = files[0].webkitRelativePath.split('/')[0];
        folderHandle = { name: folderPath }; // Simulate folderHandle for fallback
        document.getElementById('status-message').innerText = `Folder selected: ${folderPath}`;
        document.getElementById('create-profile-btn').classList.remove('d-none');
    } else {
        alert('No files selected. Please try again.');
    }
}

// Create Profile
async function createProfile() {
    const username = document.getElementById('username').value.trim();

    if (!username) {
        alert('Please enter a valid username.');
        return;
    }

    if (!folderHandle) {
        alert('No folder selected. Please select a folder before saving the profile.');
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

    // Create placeholder files
    await createPlaceholderFiles();

    alert('Profile created successfully.');
    document.getElementById('open-data-btn').classList.remove('d-none');
}

// Placeholder function to create additional files
async function createPlaceholderFiles() {
    const filesToCreate = ['notes.csv', 'annotations.csv', 'summary.txt'];
    for (const fileName of filesToCreate) {
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
}

// Open Data Tab
function openDataTab() {
    window.open('files-preview.html', '_blank');
}
