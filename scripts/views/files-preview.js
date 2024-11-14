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

        // Log the raw text and parsed data for debugging
        console.log('Raw CSV Text:', text);
        console.log('Parsed CSV Data:', parsedData);

        if (parsedData.errors.length > 0) {
            console.error('CSV Parsing Errors:', parsedData.errors);
            alert('There were errors parsing users.csv. Please check the file format.');
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

// Display 'users.csv' as a Table
function displayUsersTable(fields, data) {
    const filePreviewDiv = document.getElementById('file-preview');

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

    // Generate HTML table
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
