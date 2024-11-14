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


async function accessUserFolder() {
    try {
        // Re-request the user to select the base folder
        const baseFolderHandle = await window.showDirectoryPicker();
        
        try {
            const usersFolderHandle = await baseFolderHandle.getDirectoryHandle('Users', { create: false });
            console.log('Found Users directory');
            
            try {
                // Try to access username directory
                userFolderHandle = await usersFolderHandle.getDirectoryHandle(username, { create: false }); // Changed this line
                console.log(`Found ${username} directory`);
                
                try {
                    // Try to access 'Data' directory
                    await userFolderHandle.getDirectoryHandle('Data', { create: false });
                    console.log('Found Data directory');
                    
                    // Remove window. prefix, just use the global variable
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
        console.log('Starting to load users.csv...');
        console.log('User folder handle:', userFolderHandle);
        
        const dataFolderHandle = await userFolderHandle.getDirectoryHandle('Data');
        console.log('Data folder accessed successfully');
        
        const usersCSVHandle = await dataFolderHandle.getFileHandle('users.csv');
        console.log('users.csv file handle obtained');
        
        const file = await usersCSVHandle.getFile();
        console.log('File object created');
        
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
        displayUsersTable(Object.keys(parsedData.data[0]), parsedData.data);
    
    } catch (error) {
        console.error('Detailed error in loadUsersCSV:', {
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack
        });
        
        if (error.name === 'NotFoundError') {
            alert('Could not find users.csv in the Data folder. Please ensure the file exists.');
        } else if (error.name === 'SecurityError') {
            alert('Permission denied while trying to access users.csv. Please try selecting the folder again.');
        } else {
            alert(`Error loading users.csv: ${error.message}`);
        }
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

    // Debug logging
    console.log('Received fields:', fields);
    console.log('Received data:', data);

    // Column name mapping
    const columnDisplayNames = {
        'Author': 'Author',
        'TotalPosts': 'Total posts on reddit',
        'Conspiracy': 'Posts on r/conspiracy',
        'DaysDifference': 'Length of activity',
        [`Notes_${username}`]: 'Notes',
        [`Summary_${username}`]: 'Activity'
    };

    // Create table HTML
    let tableHTML = `
        <h3>Users CSV Data</h3>
        <div class="table-responsive">
            <table id="users-table" class="table table-striped table-bordered">
                <thead class="thead-dark">
                    <tr>
                        ${fields.map(field => {
                            const displayName = columnDisplayNames[field] || field;
                            return `<th scope="col">${displayName}</th>`;
                        }).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    // Create rows with conditional formatting
    data.forEach(row => {
        if (row && typeof row === 'object') {
            // Find the Summary column for the current user
            const summaryColumn = fields.find(field => field.startsWith('Summary_'));
            const summaryValue = summaryColumn ? row[summaryColumn] : '';
            
            // Determine row color based on Summary value
            let rowClass = '';
            if (summaryValue === 'Done') {
                rowClass = 'background-color: #d4edda;'; // Bootstrap success color (green)
            } else if (summaryValue && summaryValue !== 'Done') {
                rowClass = 'background-color: #fff3cd;'; // Bootstrap warning color (yellow)
            }

            tableHTML += `<tr style="${rowClass}">`;
            fields.forEach(field => {
                const value = row[field];
                tableHTML += `<td>${value !== undefined && value !== null ? value : ''}</td>`;
            });
            tableHTML += '</tr>';
        }
    });

    tableHTML += `
                </tbody>
            </table>
        </div>
    `;

    // Update the DOM
    filePreviewDiv.innerHTML = tableHTML;
    console.log('Table rendered successfully.');
}

// Initialize the Files Preview Page
document.addEventListener('DOMContentLoaded', loadFilesPreview);