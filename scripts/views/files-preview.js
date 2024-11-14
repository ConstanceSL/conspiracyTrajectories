// Globals
let userFolderHandle = null;
let username = '';
let usersCSVData = [];

// Initialize Files Preview Page
async function loadFilesPreview() {
    const urlParams = new URLSearchParams(window.location.search);
    username = urlParams.get('username');

    if (!username) {
        alert('No username selected. Redirecting back to the Welcome Screen.');
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('username-display').textContent = username;

    try {
        await loadUsersCSV();
    } catch (error) {
        console.error('Error loading users.csv:', error);
        alert('Failed to load users.csv.');
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
