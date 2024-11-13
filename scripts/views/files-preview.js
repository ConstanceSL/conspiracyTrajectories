// Globals
let userFolderHandle = null;
let username = '';
let usersCSVData = [];
let currentFileHandle = null;
let currentFileData = [];

// Initialize Files Preview Page
async function loadFilesPreview() {
    username = sessionStorage.getItem('selectedUser'); // Get the stored username
    const baseFolderName = sessionStorage.getItem('baseFolderName'); // Get the stored folder name

    if (!username || !baseFolderName) {
        alert('No username or folder selected. Redirecting back to the Welcome Screen.');
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('username-display').textContent = username;

    try {
        // Directly access the stored folder
        await accessUserFolder(baseFolderName);
        await loadUsersCSV();
    } catch (error) {
        console.error(`Error loading users.csv: ${error.message}`);
        alert(`Failed to load users.csv for "${username}". Please check the folder structure.`);
    }
}

// Access User Folder from Stored Information
async function accessUserFolder(baseFolderName) {
    try {
        const baseFolderHandle = await navigator.storage.getDirectory();
        const usersFolderHandle = await baseFolderHandle.getDirectoryHandle('Users');
        userFolderHandle = await usersFolderHandle.getDirectoryHandle(username);
        console.log(`User folder for "${username}" accessed successfully from sessionStorage.`);
    } catch (error) {
        throw new Error(`Failed to access user folder for "${username}". Ensure the folder structure is correct.`);
    }
}

// Load and Parse 'users.csv'
async function loadUsersCSV() {
    try {
        const dataFolderHandle = await userFolderHandle.getDirectoryHandle('Data');
        const usersCSVHandle = await dataFolderHandle.getFileHandle('users.csv');
        const file = await usersCSVHandle.getFile();
        const text = await file.text();
        const parsedData = Papa.parse(text, { header: true });

        if (parsedData.errors.length > 0) {
            console.error('CSV Parsing Errors:', parsedData.errors);
            alert('There were errors parsing users.csv. Please check the file format.');
            return;
        }

        usersCSVData = parsedData.data;
        displayUsersTable(parsedData.meta.fields, parsedData.data);
    } catch (error) {
        throw new Error('Failed to load and parse users.csv.');
    }
}
