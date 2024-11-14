// Globals
let userFolderHandle = null;
let username = '';
let usersCSVData = [];
let currentFileHandle = null;
let currentFileData = [];


document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    username = urlParams.get('username'); // Assign to global username variable
    console.log('Received username:', username);

    // Optional: Display the username in the UI
    const usernameDisplay = document.getElementById('username-display');
    if (usernameDisplay) {
        usernameDisplay.textContent = username;
    }

    // Since username is now set, we can proceed with loading the files
    loadFilesPreview(); // Call this after setting the username
});


// Initialize Files Preview Page
// ... existing code ...

async function loadFilesPreview() {
    if (!username) {
        alert('No username selected. Redirecting back to the Welcome Screen.');
        window.location.href = 'index.html';
        return;
    }

    // Create and show the folder selection button
    const filePreviewDiv = document.getElementById('file-preview');
    filePreviewDiv.innerHTML = `
        <div class="text-center mb-4">
            <button id="selectFolderBtn" class="btn btn-primary">
                Select Data Folder
            </button>
        </div>
    `;

    // Add click handler for the button
    document.getElementById('selectFolderBtn').addEventListener('click', async () => {
        try {
            await accessUserFolder();
            await loadUsersCSV();
        } catch (error) {
            if (error.name === 'NotFoundError') {
                console.error('Folder structure error:', error.message);
                alert(`Folder structure error: ${error.message}\nPlease verify that your folder contains:\n- Users/\n  - ${username}/\n    - Data/`);
            } 
            else if (error.name === 'SecurityError') {
                console.error('Permission denied:', error.message);
                alert('Permission to access the folder was denied. Please grant access when prompted.');
            } 
            else {
                console.error('Unexpected error:', error);
                alert(`An unexpected error occurred: ${error.message}`);
            }
        }
    });
}

// ... rest of the code ...

async function accessUserFolder() {
    try {
        // Re-request the user to select the base folder
        const baseFolderHandle = await window.showDirectoryPicker();
        
        try {
            // Try to access 'Users' directory
            const usersFolderHandle = await baseFolderHandle.getDirectoryHandle('Users', { create: false });
            console.log('Found Users directory');
            
            try {
                // Try to access username directory
                const userFolderHandle = await usersFolderHandle.getDirectoryHandle(username, { create: false });
                console.log(`Found ${username} directory`);
                
                try {
                    // Try to access 'Data' directory
                    await userFolderHandle.getDirectoryHandle('Data', { create: false });
                    console.log('Found Data directory');
                    
                    // Store the user folder handle for further access
                    window.userFolderHandle = userFolderHandle;
                    console.log(`User folder for "${username}" accessed successfully.`);
                } catch (error) {
                    throw new Error(`Could not find 'Data' folder inside ${username}'s directory`);
                }
            } catch (error) {
                throw new Error(`Could not find folder for user "${username}" inside Users directory`);
            }
        } catch (error) {
            throw new Error('Could not find Users directory in selected folder');
        }
    } catch (error) {
        if (error.name === 'SecurityError') {
            throw error; // Re-throw permission errors
        }
        throw new Error(`${error.message}. Please ensure the folder structure is correct.`);
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