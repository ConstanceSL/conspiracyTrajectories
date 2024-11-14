// Globals
let userFolderHandle = null;
let username = '';
let usersCSVData = [];
let currentFileHandle = null;
let currentFileData = [];

// Initialize Files Preview Page
async function loadFilesPreview() {
    username = sessionStorage.getItem('selectedUser');

    if (!username) {
        alert('No username selected. Redirecting back to the Welcome Screen.');
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('username-display').textContent = username;

    try {
        // Request folder access from the user
        await accessUserFolder();
        await loadUsersCSV();
    } catch (error) {
        console.error(`Error loading users.csv: ${error.message}`);
        alert(`Failed to load users.csv for "${username}". Please check the folder structure.`);
    }
}


// Access User Folder Using Folder Picker
async function accessUserFolder() {
    try {
        // Re-request the user to select the base folder
        const baseFolderHandle = await window.showDirectoryPicker();

        // Check if the selected folder contains 'Users' subdirectory
        const usersFolderHandle = await baseFolderHandle.getDirectoryHandle('Users', { create: false });
        const userFolderHandle = await usersFolderHandle.getDirectoryHandle(username, { create: false });

        // Check if the user folder contains 'Data' subdirectory
        await userFolderHandle.getDirectoryHandle('Data', { create: false });

        // Store the user folder handle for further access
        userFolderHandle = userFolderHandle;
        console.log(`User folder for "${username}" accessed successfully.`);
    } catch (error) {
        throw new Error(`Failed to access user folder for "${username}". Ensure the folder structure is correct.`);
    }
}

// Load and Parse 'users.csv' with Enhanced Debugging
async function loadUsersCSV() {
    try {
        const dataFolderHandle = await userFolderHandle.getDirectoryHandle('Data');
        const usersCSVHandle = await dataFolderHandle.getFileHandle('users.csv');
        const file = await usersCSVHandle.getFile();
        const text = await file.text();

        console.log('Raw CSV Text:', text);

        const parsedData = Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
        });

        console.log('Parsed CSV Data:', parsedData);

        if (parsedData.errors.length > 0) {
            console.error('CSV Parsing Errors:', parsedData.errors);
            alert('CSV parsing failed. Please check the format of users.csv.');
            return;
        }

        if (!parsedData.data || parsedData.data.length === 0) {
            console.error('Parsed data is empty.');
            alert('No data found in users.csv.');
            return;
        }

        usersCSVData = parsedData.data;
        displayUsersTable(parsedData.meta.fields, parsedData.data);
    } catch (error) {
        console.error('Error loading and parsing users.csv:', error);
        alert('Failed to load and parse users.csv.');
    }
}

// Display 'users.csv' as a Table with Debugging
function displayUsersTable(fields, data) {
    const filePreviewDiv = document.getElementById('file-preview');

    if (!filePreviewDiv) {
        console.error('Table container "file-preview" not found.');
        alert('Failed to find the table container.');
        return;
    }

    if (!fields || fields.length === 0) {
        console.error('No fields found in CSV data.');
        alert('No columns found in users.csv.');
        return;
    }

    if (!data || data.length === 0) {
        console.error('No rows found in CSV data.');
        alert('No rows found in users.csv.');
        return;
    }

    console.log('Fields:', fields);
    console.log('Data:', data);

    let tableHTML = `
        <h3>Users CSV Data</h3>
        <table id="users-table" class="table table-striped">
            <thead>
                <tr>${fields.map(field => `<th>${field}</th>`).join('')}</tr>
            </thead>
            <tbody>
    `;

    for (let row of data) {
        tableHTML += `<tr>${fields.map(field => `<td>${row[field] || ''}</td>`).join('')}</tr>`;
    }

    tableHTML += `</tbody></table>`;

    filePreviewDiv.innerHTML = tableHTML;
    console.log('Table rendered successfully.');
}

// Initialize the Files Preview Page
document.addEventListener('DOMContentLoaded', loadFilesPreview);