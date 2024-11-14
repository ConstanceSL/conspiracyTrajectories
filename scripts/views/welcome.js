// Globals
let folderHandle = null;
let usersFolderHandle = null;
let selectedUser = '';
let usersList = [];
let userFolderHandle = null;
let usersCSVData = [];
let currentFileHandle = null;
let currentFileData = [];

// Add warning before page reload/exit
window.addEventListener('beforeunload', function (e) {
    // Cancel the event
    e.preventDefault();
    // Chrome requires returnValue to be set
    e.returnValue = 'Changes you made may not be saved. Are you sure you want to leave?';
    return 'Changes you made may not be saved. Are you sure you want to leave?';
});

// Check Browser Compatibility
function checkBrowserCompatibility() {
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    if (!isChrome) {
        alert('This app is only supported in Google Chrome. Please open the app in Chrome for full functionality.');
        document.body.innerHTML = '<h2 style="color: red; text-align: center;">Unsupported Browser</h2>';
        throw new Error('Unsupported browser detected. Please use Google Chrome.');
    }
}

// Welcome Screen
async function loadWelcomeScreen() {
    checkBrowserCompatibility();

    const appContent = document.getElementById('app-content');
    appContent.innerHTML = `
        <h2>Welcome to the Social Media Analysis App</h2>
        <button id="select-data-folder-btn" class="btn btn-primary mt-3">Select Data Folder</button>
        <div id="user-selection" class="mt-3 d-none"></div>
        <div id="status-message" class="mt-3"></div>
    `;

    // Event listeners
    document.getElementById('select-data-folder-btn').addEventListener('click', selectDataFolder);
}

// Select Data Folder
async function selectDataFolder() {
    try {
        folderHandle = await window.showDirectoryPicker();
        document.getElementById('status-message').innerText = `Data folder selected: ${folderHandle.name}`;
        await loadUsersFolder();
    } catch (error) {
        console.error('Error selecting folder:', error);
        alert('Folder selection was cancelled. Please try again.');
    }
}

// Load Users Folder
async function loadUsersFolder() {
    try {
        usersFolderHandle = await folderHandle.getDirectoryHandle('Users', { create: true });
        console.log('Users folder accessed.');

        usersList = [];
        for await (const entry of usersFolderHandle.values()) {
            if (entry.kind === 'directory') {
                usersList.push(entry.name);
            }
        }

        displayUserSelection();
    } catch (error) {
        console.error('Error loading Users folder:', error);
        alert('The selected folder does not contain a "Users" subfolder. Please choose the correct folder.');
        await selectDataFolder();
    }
}

// Display User Selection
function displayUserSelection() {
    const userSelectionDiv = document.getElementById('user-selection');
    userSelectionDiv.classList.remove('d-none');

    let html = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h3>Select a User:</h3>
            <button id="new-user-btn" 
                    class="btn btn-success" 
                    onclick="promptNewUser()">
                <i class="bi bi-plus-circle"></i> Add New User
            </button>
        </div>
        <div class="user-buttons">
    `;

    if (usersList.length === 0) {
        html += '<p>No user folders found. Click "Add New User" to create one.</p>';
    } else {
        usersList.forEach(user => {
            html += `
                <button id="user-btn-${user}" 
                        class="btn btn-outline-primary m-2 user-btn" 
                        onclick="selectUser('${user}')">
                    ${user}
                </button>
            `;
        });
    }

    html += '</div>';
    userSelectionDiv.innerHTML = html;
}

// Modify the promptNewUser function to create the folder structure and copy data
async function promptNewUser() {
    const newUsername = prompt('Enter a new username:');
    if (!newUsername) {
        alert('Invalid username. Please try again.');
        return;
    }

    if (usersList.includes(newUsername)) {
        alert('Username already exists. Please choose a different name.');
        return;
    }

    try {
        // Create user directory
        const newUserHandle = await usersFolderHandle.getDirectoryHandle(newUsername, { create: true });
        console.log(`Created directory for ${newUsername}`);

        // Create Data subdirectory and copy contents
        await copyDataFolder(newUserHandle, newUsername);
        console.log('Copied data folder contents');
        
        // Add to users list and refresh display
        usersList.push(newUsername);
        displayUserSelection();
        
        alert(`User folder "${newUsername}" created successfully!`);
    } catch (error) {
        console.error('Error creating new user folder:', error);
        alert('Failed to create new user folder. Please try again.');
    }
}

// Create New User Folder
async function createNewUserFolder(username) {
    try {
        const userFolderHandle = await usersFolderHandle.getDirectoryHandle(username, { create: true });
        console.log(`User folder "${username}" created successfully.`);

        // Copy 'Data' folder into the new user folder
        await copyDataFolder(userFolderHandle, username);

        loadUsersFolder(); // Refresh the user list
    } catch (error) {
        console.error('Error creating new user folder:', error);
        alert('Failed to create new user folder.');
    }
}

// Copy 'Data' Folder and 'TrajectoriesToAnalyse' Folder, Modify CSV Files
async function copyDataFolder(userFolderHandle, username) {
    try {
        const dataFolderHandle = await folderHandle.getDirectoryHandle('Data');
        const userDataFolderHandle = await userFolderHandle.getDirectoryHandle('Data', { create: true });

        // Copy files from the root 'Data' folder
        for await (const entry of dataFolderHandle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.csv')) {
                await copyAndModifyCSVFile(dataFolderHandle, userDataFolderHandle, entry.name, username);
            } else if (entry.kind === 'directory' && entry.name === 'TrajectoriesToAnalyse') {
                // Copy 'TrajectoriesToAnalyse' folder
                const sourceTrajectoriesHandle = await dataFolderHandle.getDirectoryHandle('TrajectoriesToAnalyse');
                const userTrajectoriesHandle = await userDataFolderHandle.getDirectoryHandle('TrajectoriesToAnalyse', { create: true });
                await copyTrajectoriesFolder(sourceTrajectoriesHandle, userTrajectoriesHandle, username);
            }
        }

        console.log('Data folder and TrajectoriesToAnalyse folder copied successfully.');
    } catch (error) {
        console.error('Error copying Data folder:', error);
        alert('Failed to copy and modify the Data folder.');
    }
}

// Helper Function to Copy and Modify a CSV File
async function copyAndModifyCSVFile(sourceFolderHandle, targetFolderHandle, fileName, username) {
    try {
        const fileHandle = await sourceFolderHandle.getFileHandle(fileName);
        const newFileHandle = await targetFolderHandle.getFileHandle(fileName, { create: true });

        const file = await fileHandle.getFile();
        const text = await file.text();
        const parsedData = Papa.parse(text, { header: true });
        const notesColumn = `Notes_${username}`;

        if (!parsedData.meta.fields.includes(notesColumn)) {
            parsedData.meta.fields.push(notesColumn);
            parsedData.data.forEach(row => {
                row[notesColumn] = '';
            });
        }
        const summaryColumn = `Summary_${username}`;
        if (!parsedData.meta.fields.includes(summaryColumn)) {
            parsedData.meta.fields.push(summaryColumn);
            parsedData.data.forEach(row => {
                row[summaryColumn] = '';
            });
        }
        const csvContent = Papa.unparse(parsedData.data);
        const writable = await newFileHandle.createWritable();
        await writable.write(csvContent);
        await writable.close();

        console.log(`CSV file "${fileName}" copied and modified successfully.`);
    } catch (error) {
        console.error(`Error copying and modifying CSV file "${fileName}":`, error);
    }
}

// Helper Function to Copy 'TrajectoriesToAnalyse' Folder and Modify CSV Files
async function copyTrajectoriesFolder(sourceFolderHandle, targetFolderHandle, username) {
    try {
        for await (const entry of sourceFolderHandle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.csv')) {
                await copyAndModifyCSVFile(sourceFolderHandle, targetFolderHandle, entry.name, username);
            } else if (entry.kind === 'file') {
                // Copy non-CSV files directly
                const fileHandle = await sourceFolderHandle.getFileHandle(entry.name);
                const newFileHandle = await targetFolderHandle.getFileHandle(entry.name, { create: true });
                const file = await fileHandle.getFile();
                const writable = await newFileHandle.createWritable();
                await writable.write(await file.arrayBuffer());
                await writable.close();

                console.log(`File "${entry.name}" copied successfully.`);
            }
        }

        console.log('TrajectoriesToAnalyse folder copied and CSV files modified successfully.');
    } catch (error) {
        console.error('Error copying TrajectoriesToAnalyse folder:', error);
        alert('Failed to copy and modify the TrajectoriesToAnalyse folder.');
    }
}

// Select User and Initialize File Preview
async function selectUser(username) {
    selectedUser = username;

    // Highlight the selected user
    document.querySelectorAll('.user-btn').forEach(btn => {
        btn.classList.remove('active-user');
    });
    const selectedButton = document.getElementById(`user-btn-${username}`);
    selectedButton.classList.add('active-user');

    // Set sessionStorage for the selected username
    sessionStorage.setItem('selectedUser', selectedUser);

    // Clear and initialize file preview area
    const filePreviewDiv = document.getElementById('file-preview');
    filePreviewDiv.innerHTML = `
        <div class="text-center mb-4">
            <h3>Data for user: ${selectedUser}</h3>
        </div>
    `;

    // Directly proceed with loading the data
    try {
        await accessUserFolder();
        await loadUsersCSV();
    } catch (error) {
        handleFolderAccessError(error);
    }
}

// Access User Folder
async function accessUserFolder() {
    try {
        // Use the existing folder handle instead of requesting a new one
        try {
            userFolderHandle = await usersFolderHandle.getDirectoryHandle(selectedUser, { create: false });
            console.log(`Found ${selectedUser} directory`);
            
            try {
                await userFolderHandle.getDirectoryHandle('Data', { create: false });
                console.log('Found Data directory');
                console.log(`User folder for "${selectedUser}" accessed successfully.`);
            } catch (error) {
                throw new Error(`Could not find 'Data' folder inside ${selectedUser}'s directory`);
            }
        } catch (error) {
            throw new Error(`Could not find folder for user "${selectedUser}" inside Users directory`);
        }
    } catch (error) {
        if (error.name === 'SecurityError') {
            throw error;
        }
        throw new Error(`${error.message}. Please ensure the folder structure is correct.`);
    }
}

// Error Handler for Folder Access
function handleFolderAccessError(error) {
    if (error.name === 'NotFoundError') {
        console.error('Folder structure error:', error.message);
        alert(`Folder structure error: ${error.message}\nPlease verify that your folder contains:\n- Users/\n  - ${selectedUser}/\n    - Data/`);
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
        [`Notes_${selectedUser}`]: 'Notes',
        [`Summary_${selectedUser}`]: 'Activity'
    };

    // Create table HTML
    let tableHTML = `
        <h3>Users CSV Data</h3>
        <div class="table-responsive">
            <table id="users-table" class="table table-striped table-bordered">
                <thead class="thead-dark">
                    <tr>
                        ${fields.map(field => {
                            if (field.startsWith('Notes_')) {
                                return '<th scope="col">Notes</th>';
                            }
                            return `<th scope="col">${columnDisplayNames[field] || field}</th>`;
                        }).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    // Create rows with conditional formatting and make them clickable
    data.forEach(row => {
        if (row && typeof row === 'object') {
            const summaryColumn = fields.find(field => field.startsWith('Summary_'));
            const summaryValue = summaryColumn ? row[summaryColumn] : '';
            
            let rowClass = '';
            if (summaryValue === 'Done') {
                rowClass = 'background-color: #d4edda;'; // Bootstrap success color (green)
            } else if (summaryValue && summaryValue !== 'Done') {
                rowClass = 'background-color: #fff3cd;'; // Bootstrap warning color (yellow)
            }

            // Add cursor pointer and click handler
            tableHTML += `<tr style="${rowClass}; cursor: pointer;" 
                            onclick="displayTrajectoryFile('${row.Author}')" 
                            title="Click to view trajectory file">`;
            
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

    // Add CSS for hover effect
    const style = document.createElement('style');
    style.textContent = `
        #users-table tbody tr:hover {
            background-color: #f5f5f5 !important;
            transition: background-color 0.2s;
        }
    `;
    document.head.appendChild(style);

    // Update the DOM
    filePreviewDiv.innerHTML = tableHTML;
    console.log('Table rendered successfully.');
}

async function displayTrajectoryFile(author) {
    try {
        // Hide the users table section
        const appContent = document.getElementById('app-content');
        const userSelection = document.getElementById('user-selection');
        const statusMessage = document.getElementById('status-message');
        
        appContent.style.display = 'none';
        userSelection.style.display = 'none';
        statusMessage.style.display = 'none';

        // Get the current notes for this author from usersCSVData
        const authorData = usersCSVData.find(row => row.Author === author);
        const currentNotes = authorData ? authorData[`Notes_${selectedUser}`] || '' : '';

        // Get the file content
        const dataFolderHandle = await userFolderHandle.getDirectoryHandle('Data');
        const trajectoriesFolderHandle = await dataFolderHandle.getDirectoryHandle('TrajectoriesToAnalyse');
        const trajectoryFileHandle = await trajectoriesFolderHandle.getFileHandle(`${author}.csv`);
        const file = await trajectoryFileHandle.getFile();
        const fileContent = await file.text();

        // Parse CSV content
        const parsedData = Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
        });

        // Filter and rename columns
        const selectedColumns = ['year', 'day_month', 'title', `Summary_${selectedUser}`];
        const columnNames = ['col1', 'col2', 'col3', 'col4'];

        // Create HTML for trajectory view with comments section
        const filePreviewDiv = document.getElementById('file-preview');
        filePreviewDiv.innerHTML = `
            <style>
                .trajectory-table th:nth-child(2),
                .trajectory-table td:nth-child(2) {
                    width: auto;
                    white-space: nowrap;
                }
                .trajectory-table th:nth-child(3),
                .trajectory-table td:nth-child(3) {
                    width: 60%;
                }
                .trajectory-table td {
                    vertical-align: middle;
                }
            </style>
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h3>Trajectory Data for ${author}</h3>
                <button class="btn btn-primary" onclick="reloadUsersTable()">
                    ← Back to Users Table
                </button>
            </div>
            <div class="mb-4">
                <div class="form-group">
                    <label for="userNotes" class="form-label">Notes:</label>
                    <textarea id="userNotes" class="form-control" rows="3">${currentNotes}</textarea>
                </div>
                <button class="btn btn-success mt-2" onclick="saveNotes('${author}')">
                    Save Comments
                </button>
            </div>
            <div class="table-responsive">
                <table class="table table-striped table-bordered trajectory-table">
                    <thead class="thead-dark">
                        <tr>
                            ${columnNames.map(colName => 
                                `<th scope="col">${colName}</th>`
                            ).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${parsedData.data.map(row => {
                            const summaryValue = row[`Summary_${selectedUser}`];
                            let rowClass = '';
                            
                            if (summaryValue === 'Done') {
                                rowClass = 'background-color: #d4edda;'; // Green
                            } else if (summaryValue && summaryValue !== 'Done') {
                                rowClass = 'background-color: #fff3cd;'; // Yellow
                            }

                            return `
                                <tr style="${rowClass}">
                                    ${selectedColumns.map(field => 
                                        `<td>${row[field] !== undefined && row[field] !== null ? row[field] : ''}</td>`
                                    ).join('')}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Add the saveNotes function to handle saving
        window.saveNotes = async function(author) {
            try {
                const newNotes = document.getElementById('userNotes').value;
                
                // Get the Data folder and users.csv file handles
                const dataFolderHandle = await userFolderHandle.getDirectoryHandle('Data');
                const usersCSVHandle = await dataFolderHandle.getFileHandle('users.csv');
                
                // Update the notes and summary in the data
                const authorIndex = usersCSVData.findIndex(row => row.Author === author);
                if (authorIndex !== -1) {
                    // Update notes
                    usersCSVData[authorIndex][`Notes_${selectedUser}`] = newNotes;
                    
                    // Update summary based on conditions
                    const summaryColumn = `Summary_${selectedUser}`;
                    const currentSummary = usersCSVData[authorIndex][summaryColumn] || '';
                    
                    if (newNotes.trim() !== '') {
                        // If notes are not empty and 'Notes saved' isn't already there, add it
                        if (!currentSummary.includes('Notes saved')) {
                            usersCSVData[authorIndex][summaryColumn] = 
                                currentSummary ? `${currentSummary}, Notes saved` : 'Notes saved';
                        }
                    } else {
                        // If notes are empty and 'Notes saved' is there, remove it
                        if (currentSummary.includes('Notes saved')) {
                            usersCSVData[authorIndex][summaryColumn] = 
                                currentSummary.replace(/, Notes saved|Notes saved,|Notes saved/, '').trim();
                        }
                    }
                    
                    // Write the updated data back to the file
                    const csvContent = Papa.unparse(usersCSVData);
                    const writable = await usersCSVHandle.createWritable();
                    await writable.write(csvContent);
                    await writable.close();
                    
                    alert('Notes saved successfully!');
                }
            } catch (error) {
                console.error('Error saving notes:', error);
                alert('Failed to save notes. Please try again.');
            }
        };

    } catch (error) {
        console.error('Error displaying trajectory file:', error);
        alert(`Could not display trajectory file for ${author}. Please ensure the file exists in the TrajectoriesToAnalyse folder.`);
    }
}

// Function to reload the users table
async function reloadUsersTable() {
    try {
        // Show the users table section again
        const appContent = document.getElementById('app-content');
        const userSelection = document.getElementById('user-selection');
        const statusMessage = document.getElementById('status-message');
        
        appContent.style.display = 'block';
        userSelection.style.display = 'block';
        statusMessage.style.display = 'block';

        await loadUsersCSV();
    } catch (error) {
        console.error('Error reloading users table:', error);
        alert('Failed to reload users table. Please try again.');
    }
}

// Initialize the Welcome Screen
document.addEventListener('DOMContentLoaded', loadWelcomeScreen);