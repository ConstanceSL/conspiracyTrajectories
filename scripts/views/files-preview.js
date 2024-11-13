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
        // Directly access the user's folder based on the expected structure
        await loadUserFolder();
        await loadUsersCSV();
    } catch (error) {
        console.error(`Error loading users.csv: ${error.message}`);
        alert(`Failed to load users.csv for "${username}". Please check the folder structure.`);
    }
}

// Directly Access the User Folder
async function loadUserFolder() {
    try {
        // Access the user's folder using the assumed path 'Users/<username>/Data'
        const usersFolderHandle = await navigator.storage.getDirectory();
        const userFolderHandle = await usersFolderHandle.getDirectoryHandle('Users');
        userFolderHandle = await userFolderHandle.getDirectoryHandle(username);
        userFolderHandle = await userFolderHandle.getDirectoryHandle('Data');
        console.log(`User folder for "${username}" accessed successfully.`);
    } catch (error) {
        throw new Error(`Failed to access user folder for "${username}". Ensure the folder structure is correct.`);
    }
}

// Load and Parse 'users.csv'
async function loadUsersCSV() {
    try {
        const usersCSVHandle = await userFolderHandle.getFileHandle('users.csv');
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
