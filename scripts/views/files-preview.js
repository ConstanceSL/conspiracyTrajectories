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
        // Ask user to confirm accessing the user's folder
        await requestUserFolderAccess();
        await loadUsersCSV();
    } catch (error) {
        console.error(`Error loading users.csv: ${error.message}`);
        alert(`Failed to load users.csv for "${username}". Please check the folder structure and permissions.`);
    }
}

// Request User Folder Access
async function requestUserFolderAccess() {
    try {
        // Ask the user to select the "Users" folder manually
        const folderHandle = await window.showDirectoryPicker();
        const usersFolderHandle = await folderHandle.getDirectoryHandle('Users', { create: false });
        userFolderHandle = await usersFolderHandle.getDirectoryHandle(username);
        console.log(`User folder for "${username}" accessed successfully.`);
    } catch (error) {
        throw new Error(`Failed to access user folder for "${username}". Ensure the correct folder is selected.`);
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
