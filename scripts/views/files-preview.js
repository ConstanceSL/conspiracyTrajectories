// Globals
let userFolderHandle = null;
let username = '';
let usersCSVData = [];
let currentFileHandle = null;
let currentFileData = [];

// Initialize Files Preview Page
async function loadFilesPreview() {
    const urlParams = new URLSearchParams(window.location.search);
    username = urlParams.get('username'); // Get the username from the URL parameter

    if (!username || username.trim() === '') {
        alert('No username selected. Redirecting back to the Welcome Screen.');
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('username-display').textContent = username;

    try {
        // Request user to manually select the base data folder
        await requestUserFolderAccess();
        await validateFolderStructure();
        await loadUsersCSV();
    } catch (error) {
        console.error(`Error loading users.csv: ${error.message}`);
        alert(`Failed to load users.csv for "${username}". Please check the folder structure and permissions.`);
    }
}

// Request User Folder Access
async function requestUserFolderAccess() {
    try {
        // Let the user select the base folder (e.g., the root folder containing 'Users')
        const baseFolderHandle = await window.showDirectoryPicker();
        const usersFolderHandle = await baseFolderHandle.getDirectoryHandle('Users', { create: false });

        // Access the specific user's folder
        userFolderHandle = await usersFolderHandle.getDirectoryHandle(username, { create: false });
        console.log(`User folder for "${username}" accessed successfully.`);
    } catch (error) {
        throw new Error(`Failed to access user folder for "${username}". Ensure the correct folder is selected.`);
    }
}

// Validate Folder Structure
async function validateFolderStructure() {
    try {
        // Check if 'Data' folder exists inside the user's folder
        await userFolderHandle.getDirectoryHandle('Data', { create: false });
        console.log(`Data folder for user "${username}" found successfully.`);
    } catch (error) {
        throw new Error(`The 'Data' folder is missing for user "${username}". Ensure the correct folder structure.`);
    }
}

// Load and Parse 'users.csv'
async function loadUsersCSV() {
    try {
        const dataFolderHandle = await userFolderHandle.getDirectoryHandle('Data');
        const usersCSVHandle = await dataFolderHandle.getFileHandle('users.csv', { create: false });
        const file = await usersCSVHandle.getFile();
        const text = await file.text();
        const parsedData = Papa.parse(text, { header: true });

        if (parsedData.errors.length > 0) {
            console.error('CSV Parsing Errors:', parsedData.errors);
            alert('There were errors parsing users.csv. Please check the file format.');
            return;
        }

        usersCSVData = parsedData.data;
        console.log('Parsed users.csv data:', usersCSVData);
        displayUsersTable(parsedData.meta.fields, parsedData.data);
    } catch (error) {
        throw new Error('Failed to load and parse users.csv.');
    }
}

// Display 'users.csv' as a Table
function displayUsersTable(fields, data) {
    const filePreviewDiv = document.getElementById('file-preview');
    filePreviewDiv.innerHTML = `
        <h3>Users CSV Data</h3>
        <table id="users-table" class="table table-striped">
            <thead>
                <tr>${fields.map(field => `<th>${field}</th>`).join('')}</tr>
            </thead>
            <tbody>
                ${data.map(row => `
                    <tr>${fields.map(field => `<td>${row[field] || ''}</td>`).join('')}</tr>
                `).join('')}
            </tbody>
        </table>
    `;

    console.log('Table rendered successfully.');
}

// Initialize the Files Preview Page
document.addEventListener('DOMContentLoaded', loadFilesPreview);
