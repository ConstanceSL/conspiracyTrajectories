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

    // Check if the username is provided
    if (!username || username.trim() === '') {
        alert('No username selected. Redirecting back to the Welcome Screen.');
        window.location.href = 'index.html'; // Redirect to Welcome Screen
        return;
    }

    document.getElementById('username-display').textContent = username;

    try {
        // Access the user's folder and load 'users.csv'
        await loadUserFolder();
        await loadUsersCSV();
    } catch (error) {
        console.error('Error loading users.csv:', error);
        alert('Failed to load users.csv. Please make sure the folder structure is correct.');
    }
}


// Load the User Folder (Assuming Standard Path)
async function loadUserFolder() {
    try {
        // Access 'Users/username/Data' directly
        const usersFolderHandle = await navigator.storage.getDirectory();
        userFolderHandle = await usersFolderHandle.getDirectoryHandle('Users');
        userFolderHandle = await userFolderHandle.getDirectoryHandle(username);
        console.log(`User folder for "${username}" accessed successfully.`);
    } catch (error) {
        throw new Error(`Failed to access user folder for "${username}".`);
    }
}

// Load 'users.csv' and Display Table
async function loadUsersCSV() {
    try {
        const dataFolderHandle = await userFolderHandle.getDirectoryHandle('Data');
        const usersCSVHandle = await dataFolderHandle.getFileHandle('users.csv');
        const file = await usersCSVHandle.getFile();
        const text = await file.text();
        const parsedData = Papa.parse(text, { header: true });

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
        <h3>Users CSV</h3>
        <table id="users-table" class="table">
            <thead>
                <tr>${fields.map(field => `<th>${field}</th>`).join('')}</tr>
            </thead>
            <tbody></tbody>
        </table>
    `;

    const tableBody = document.querySelector('#users-table tbody');
    tableBody.innerHTML = data.map((row, index) => `
        <tr data-index="${index}">
            ${fields.map(field => `<td>${row[field] || ''}</td>`).join('')}
        </tr>
    `).join('');

    tableBody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', () => {
            const rowIndex = row.getAttribute('data-index');
            const authorName = usersCSVData[rowIndex]['Author'];
            openTrajectoriesFile(authorName);
        });
    });
}

// Open File from 'TrajectoriesToAnalyse'
async function openTrajectoriesFile(authorName) {
    try {
        const fileName = `${authorName}.csv`;
        const dataFolderHandle = await userFolderHandle.getDirectoryHandle('Data');
        const trajectoriesFolderHandle = await dataFolderHandle.getDirectoryHandle('TrajectoriesToAnalyse');
        const fileHandle = await trajectoriesFolderHandle.getFileHandle(fileName);

        const file = await fileHandle.getFile();
        const text = await file.text();
        const parsedData = Papa.parse(text, { header: true });

        currentFileHandle = fileHandle;
        currentFileData = parsedData.data;
        displayFilePreview(parsedData.meta.fields, parsedData.data);
    } catch (error) {
        console.error(`Error opening file "${authorName}.csv":`, error);
        alert(`Failed to open file "${authorName}.csv".`);
    }
}

// Initialize the Files Preview Page
document.addEventListener('DOMContentLoaded', loadFilesPreview);
