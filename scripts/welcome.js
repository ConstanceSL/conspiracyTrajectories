// Globals
let folderHandle = null;
let usersFolderHandle = null;
let selectedUser = '';
let usersList = [];
let userFolderHandle = null;
let usersCSVData = [];
let currentFileHandle = null;
let currentFileData = [];
let isRestoringState = false;
let lastViewedPost = null;


// Function to update URL state
function updateURLState(params = {}) {
    // Prevent triggering hashchange when we're already restoring state
    if (isRestoringState) return;
    
    const hash = new URLSearchParams();
    if (params.user) hash.set('user', params.user);
    if (params.author) hash.set('author', params.author);
    if (params.row) hash.set('row', params.row);
    window.location.hash = hash.toString();
}

// Add this function to restore state from URL
async function restoreStateFromURL() {
    if (isRestoringState) return;
    
    try {
        isRestoringState = true;
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const user = hash.get('user');
        const author = hash.get('author');
        const row = hash.get('row');

        if (user && folderHandle) {
            selectedUser = user;
            if (author) {
                if (row) {
                    // Get the row data
                    const dataFolderHandle = await userFolderHandle.getDirectoryHandle('Data');
                    const trajectoriesFolderHandle = await dataFolderHandle.getDirectoryHandle('TrajectoriesToAnalyse');
                    const trajectoryFileHandle = await trajectoriesFolderHandle.getFileHandle(`${author}.csv`);
                    const file = await trajectoryFileHandle.getFile();
                    const content = await file.text();
                    
                    // Parse with the same options as displayTrajectoryFile
                    const parsedData = Papa.parse(content, {
                        header: true,
                        skipEmptyLines: true,
                        dynamicTyping: true,
                    });
                    
                    if (parsedData.data[row - 1]) {
                        await displayRowDetails(author, parseInt(row), parsedData.data[row - 1], parsedData.data);
                    }
                } else {
                    await displayTrajectoryFile(author, true);
                }
            }
        }
    } catch (error) {
        console.error('Error restoring state from URL:', error);
    } finally {
        isRestoringState = false;
    }
}

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

// Manage notes visibility
function toggleUserNotes(show = true, author = null) {
    const userNotesSection = document.getElementById('user-notes-section');
    if (!userNotesSection) return;
    
    userNotesSection.style.display = show ? 'block' : 'none';
    
    if (show && author) {
        const authorData = usersCSVData.find(row => row.Author === author);
        const currentNotes = authorData ? authorData[`Notes_${selectedUser}`] || '' : '';
        
        userNotesSection.innerHTML = `
            <div class="mb-4 p-3" style="background-color: #f8f9fa; border-radius: 8px;">
                <h1 class="mb-3">Trajectory Data for ${author}</h1>
                <div class="form-group">
                    <label for="userNotes" class="form-label">Notes on User:</label>
                    <textarea id="userNotes" class="form-control" rows="3">${currentNotes}</textarea>
                </div>
                <button class="btn btn-success mt-2" onclick="saveNotes('${author}')">
                    Save Comments On User
                </button>
            </div>
        `;
    }
}

// Welcome Screen
async function loadWelcomeScreen() {
    checkBrowserCompatibility();
    
    const appContent = document.getElementById('app-content');
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const urlUser = hash.get('user');
    
    if (urlUser && folderHandle) {
        // If we already have a folder handle and user in URL, proceed
        await selectUser(urlUser, true);
    } else {
        // Show the initial screen with folder selection button
        appContent.innerHTML = `
            <h2>Welcome to the Social Media Analysis App</h2>
            <button id="select-data-folder-btn" class="btn btn-primary mt-3">Select Data Folder</button>
            <div id="user-selection" class="mt-3 d-none"></div>
        `;

        document.getElementById('select-data-folder-btn').addEventListener('click', selectDataFolder);
    }
}

// Select Data Folder
async function selectDataFolder() {
    try {
        folderHandle = await window.showDirectoryPicker();
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

        // Check if we have a user in the URL
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const urlUser = hash.get('user');
        
        if (urlUser && usersList.includes(urlUser)) {
            // If user exists in URL, directly select that user
            console.log(`Auto-selecting user from URL: ${urlUser}`);
            await selectUser(urlUser, true);
        } else {
            // Otherwise, show the normal user selection screen
            displayUserSelection();
        }
        
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
async function selectUser(username, isRestoring = false) {
    try {
        selectedUser = username;
        if (!isRestoring) {
            updateURLState({ user: username });
        }

         // Hide the folder selection and welcome screen elements
        const selectDataFolderBtn = document.getElementById('select-data-folder-btn');
        const userSelection = document.getElementById('user-selection');
        if (selectDataFolderBtn) selectDataFolderBtn.style.display = 'none';
        if (userSelection) userSelection.style.display = 'none';

        // Set sessionStorage
        sessionStorage.setItem('selectedUser', selectedUser);

        // Access user's folder and load data
        await accessUserFolder();
        await loadUsersCSV();

        // If we're restoring state and have an author parameter, load that trajectory
        if (isRestoring) {
            const hash = new URLSearchParams(window.location.hash.slice(1));
            const author = hash.get('author');
            if (author && usersCSVData && usersCSVData.length > 0) {
                // Add a small delay to ensure everything is loaded
                setTimeout(async () => {
                    try {
                        await displayTrajectoryFile(author, true);
                    } catch (error) {
                        console.error('Error displaying trajectory file in setTimeout:', error);
                    }
                }, 100);
            }
        }

    } catch (error) {
        console.error('Error in selectUser:', error);
        alert(`Failed to select user ${username}. Please try again.`);
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

// Display Trajectory File
async function displayTrajectoryFile(author, isRestoring = false) {
    console.log('Starting displayTrajectoryFile with:', { author, isRestoring });
    if (!isRestoring) {
        updateURLState({ user: selectedUser, author: author });
    }
    try {
        // Log the state of important variables
        console.log('Current state:', {
            selectedUser,
            userFolderHandle: !!userFolderHandle,
            usersCSVData: !!usersCSVData,
            authorData: usersCSVData.find(row => row.Author === author)
        });

        toggleUserNotes(true, author); // Show notes

        // Get the current notes for this author from usersCSVData
        const authorData = usersCSVData.find(row => row.Author === author);
        console.log('Author data found:', !!authorData);
        const currentNotes = authorData ? authorData[`Notes_${selectedUser}`] || '' : '';

        // Log before file operations
        console.log('About to access file handles');
        
        // Get the file content
        const dataFolderHandle = await userFolderHandle.getDirectoryHandle('Data');
        console.log('Got Data folder');
        const trajectoriesFolderHandle = await dataFolderHandle.getDirectoryHandle('TrajectoriesToAnalyse');
        console.log('Got TrajectoriesToAnalyse folder');
        const trajectoryFileHandle = await trajectoriesFolderHandle.getFileHandle(`${author}.csv`);
        console.log('Got trajectory file handle');
        const file = await trajectoryFileHandle.getFile();
        console.log('Got file');
        const fileContent = await file.text();
        console.log('Got file content');

        // Parse CSV content
        const parsedData = Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
        });

        // Filter and rename columns
        const selectedColumns = ['year', 'day_month', 'title', `Notes_${selectedUser}`, `Summary_${selectedUser}`];
        const columnNames = ['#', 'Year', 'Date', 'Title', 'Notes', 'Status'];  // Added '#' for row numbers

        // Create HTML for trajectory view with comments section
        const filePreviewDiv = document.getElementById('file-preview');
        filePreviewDiv.innerHTML = `
            <style>
                .trajectory-table th:first-child,
                .trajectory-table td:first-child {
                    width: 50px;
                    text-align: center;
                }
                .trajectory-table th:nth-child(3),
                .trajectory-table td:nth-child(3) {
                    width: auto;
                    white-space: nowrap;
                }
                .trajectory-table th:nth-child(4),
                .trajectory-table td:nth-child(4) {
                    width: 60%;
                }
                .trajectory-table td {
                    vertical-align: middle;
                }
            </style>
            <div class="d-flex justify-content-between align-items-center mb-3">
                <p><strong>List of Posts for ${author}</strong></p></p>
                <div class="btn-group gap-2">
                    <button class="btn btn-primary" onclick="reloadUsersTable()">
                        ← Back to Users Table
                    </button>
                    ${(() => {
                        const hash = new URLSearchParams(window.location.hash.slice(1));
                        const urlRow = hash.get('row');
                        if (lastViewedPost || urlRow) {
                            const rowNum = lastViewedPost ? lastViewedPost.rowNumber : urlRow;
                            const rowData = lastViewedPost ? lastViewedPost.rowData : parsedData.data[urlRow - 1];
                            return `
                                <button class="btn btn-primary" 
                                    onclick="displayRowDetails('${author}', ${rowNum}, ${JSON.stringify(rowData).replace(/"/g, '&quot;')})">
                                    Return to Row ${rowNum} →
                                </button>
                            `;
                        }
                         return '';
                    })()}
                </div>
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
                       ${parsedData.data.map((row, index) => {
                        
                            const summaryValue = row[`Summary_${selectedUser}`];
                            let rowClass = '';
            
                            if (summaryValue === 'Done') {
                                rowClass = 'background-color: #d4edda;';
                            } else if (summaryValue && summaryValue !== 'Done') {
                                rowClass = 'background-color: #fff3cd;';
                            }

                            return `
                            <tr style="${rowClass}; cursor: pointer;" 
                                onclick="displayRowDetails('${author}', ${index + 1}, ${JSON.stringify(row).replace(/"/g, '&quot;')}, ${JSON.stringify(parsedData.data).replace(/"/g, '&quot;')})">
                                <td>${index + 1}</td>
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
// Open a specific row in the trajectory file
async function displayRowDetails(author, rowNumber, rowData, allData) {
    try {
        toggleUserNotes(true, author); // Show notes
        // Get and display the current notes
        const authorData = usersCSVData.find(row => row.Author === author);
        const currentNotes = authorData ? authorData[`Notes_${selectedUser}`] || '' : '';
        // If allData is not provided or invalid, fetch it from the file
        if (!Array.isArray(allData)) {
            console.log('Fetching data from file...');
            const dataFolderHandle = await userFolderHandle.getDirectoryHandle('Data');
            const trajectoriesFolderHandle = await dataFolderHandle.getDirectoryHandle('TrajectoriesToAnalyse');
            const trajectoryFileHandle = await trajectoriesFolderHandle.getFileHandle(`${author}.csv`);
            const file = await trajectoryFileHandle.getFile();
            const content = await file.text();
            
            const parsedData = Papa.parse(content, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true,
            });
            
            allData = parsedData.data;
        }

        // Update URL with row number
        if (!isRestoringState) {
            updateURLState({ user: selectedUser, author: author, row: rowNumber });
        }

        // Save as last viewed post
        lastViewedPost = { author, rowNumber, rowData };

        const filePreviewDiv = document.getElementById('file-preview');
        filePreviewDiv.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h3>Post ${rowNumber} of ${allData.length}</h3>
                <div class="btn-group gap-2">
                    <button class="btn btn-primary" onclick="displayTrajectoryFile('${author}')">
                        ← Back to Trajectory
                    </button>
                    ${rowNumber > 1 && allData[rowNumber - 2] ? `
                        <button class="btn btn-primary" 
                            onclick="displayRowDetails('${author}', ${rowNumber - 1}, ${JSON.stringify(allData[rowNumber - 2]).replace(/"/g, '&quot;')}, ${JSON.stringify(allData).replace(/"/g, '&quot;')})">
                            ← Previous Post
                        </button>
                    ` : ''}
                    ${rowNumber < allData.length && allData[rowNumber] ? `
                        <button class="btn btn-primary" 
                            onclick="displayRowDetails('${author}', ${rowNumber + 1}, ${JSON.stringify(allData[rowNumber]).replace(/"/g, '&quot;')}, ${JSON.stringify(allData).replace(/"/g, '&quot;')})">
                            Next Post →
                        </button>
                    ` : ''}
                </div>
            </div>

            <div class="row mb-4">
                <!-- Notes Section -->
                <div class="col-md-6 mb-3">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="card-title mb-0">Notes on Post</h5>
                        </div>
                        <div class="card-body">
                            <textarea id="postNotes" class="form-control mb-2" rows="8"
                                >${rowData[`Notes_${selectedUser}`] || ''}</textarea>
                            <button class="btn btn-success" 
                                onclick="savePostNotes('${author}', ${rowNumber})">
                                Save Comments on Post
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Summary Section -->
                <div class="col-md-6 mb-3">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="card-title mb-0">Post Summary</h5>
                        </div>
                        <div class="card-body">
                            <p><strong>Date:</strong> ${rowData.year}-${rowData.day_month}</p>
                            <p><strong>Status:</strong> ${rowData[`Summary_${selectedUser}`] || 'Not reviewed'}</p>
                            <p><strong>Engagement:</strong></p>
                            <ul class="list-unstyled ms-3">
                                <li>👍 ${rowData.ups} upvotes</li>
                                <li>👎 ${rowData.downs} downvotes</li>
                                <li>💬 ${rowData.num_comments} comments</li>
                            </ul>
                            ${rowData.total_awards_received > 0 ? 
                                `<p>🏆 ${rowData.total_awards_received} award${rowData.total_awards_received > 1 ? 's' : ''}</p>` 
                                : ''}
                            ${rowData.is_meta === 'TRUE'? 
                                `<p>📌 Meta post</p>` 
                                : ''}
                            ${rowData.num_crossposts > 0 ? 
                                `<p>🔄 ${rowData.num_crossposts} crosspost${rowData.num_crossposts > 1 ? 's' : ''}</p>` 
                                : ''}
                            ${rowData.selftext?.trim() === '[removed]' ? 
                                `<p style="color: red; font-weight: bold;">⚠️ Removed post</p>` 
                                : ''}
                            ${rowData.selftext?.trim() === '[deleted]' ? 
                                `<p style="color: red; font-weight: bold;">⚠️ Deleted post</p>` 
                                : ''}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Content Preview -->
                <div class="card-header">
                    <div class="d-flex justify-content-between align-items-center">
                        <h5 class="card-title mb-0">Content Preview</h5>
                        <div>
                            ${(() => {
                                const url = rowData.url || '';
                                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                                return url !== rowData.permalink && !isImage ? `
                                    <a href="${url}" class="btn btn-primary btn-sm me-2" target="_blank">
                                        Linked content
                                    </a>
                                ` : '';
                            })()}
                            <a href="${rowData.permalink}" class="btn btn-success btn-sm" target="_blank">
                                Open in Reddit
                            </a>
                        </div>
                    </div>
                    <div class="mt-2">
                        <p class="mb-0"><strong>Title:</strong> ${rowData.title}</p>
                    </div>
                </div>
                <div class="card-body">
                    ${(() => {
                        // Display selftext if it exists
                        let content = '';
                        if (rowData.selftext && rowData.selftext.trim() !== '') {
                            // First add the text content
                            content += `<div class="mb-3">${rowData.selftext.replace(/\n/g, '<br>')}</div>`;
                            
                            // Then extract and add buttons for URLs
                            const urls = rowData.selftext.match(/https?:\/\/[^\s]+/g) || [];
                            if (urls.length > 0) {
                                content += `<div class="mb-3">`;
                                urls.forEach((url, index) => {
                                    const buttonText = urls.length > 1 ? `Linked content ${index + 1}` : 'Open text link';
                                    content += `
                                        <a href="${url}" class="btn btn-primary btn-sm me-2 mb-2" target="_blank">
                                            ${buttonText}
                                        </a>
                                    `;
                                });
                                content += `</div>`;
                            }
                        }
                        
                        // Check if URL is an image or video
                        const url = rowData.url || '';
                        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                        const isVideo = /\.(mp4|webm)$/i.test(url);
                        
                        if (isImage) {
                            content += `<img src="${url}" class="img-fluid" alt="Content image">`;
                        } else if (isVideo) {
                            content += `
                                <video controls class="w-100">
                                    <source src="${url}" type="video/${url.split('.').pop()}">
                                    Your browser does not support the video tag.
                                </video>
                            `;
                        }
                        
                        return content || '<p class="text-muted">No preview available</p>';
                    })()}
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error displaying row details:', error);
        alert('Failed to display row details. Please try again.');
    }
}

async function savePostNotes(author, rowNumber) {
    try {
        const newNotes = document.getElementById('postNotes').value;
        
        // Get the trajectory file
        const dataFolderHandle = await userFolderHandle.getDirectoryHandle('Data');
        const trajectoriesFolderHandle = await dataFolderHandle.getDirectoryHandle('TrajectoriesToAnalyse');
        const trajectoryFileHandle = await trajectoriesFolderHandle.getFileHandle(`${author}.csv`);
        
        // Read current content
        const file = await trajectoryFileHandle.getFile();
        const content = await file.text();
        const parsedData = Papa.parse(content, { header: true });
        
        // Update notes for the specific row
        if (parsedData.data[rowNumber - 1]) {
            // Update notes
            parsedData.data[rowNumber - 1][`Notes_${selectedUser}`] = newNotes;
            // Update summary based on notes content
            const summaryColumn = `Summary_${selectedUser}`;
            const currentSummary = parsedData.data[rowNumber - 1][summaryColumn] || '';
            
            if (newNotes.trim() !== '') {
                // If notes are not empty and 'Notes saved' isn't already there, add it
                if (!currentSummary.includes('Notes saved')) {
                    parsedData.data[rowNumber - 1][summaryColumn] = 
                        currentSummary ? `${currentSummary}, Notes saved` : 'Notes saved';
                }
            } else {
                // If notes are empty and 'Notes saved' is there, remove it
                if (currentSummary.includes('Notes saved')) {
                    parsedData.data[rowNumber - 1][summaryColumn] = 
                        currentSummary.replace(/, Notes saved|Notes saved,|Notes saved/, '').trim();
                }
            }
            
            // Write back to file
            const csvContent = Papa.unparse(parsedData.data);
            const writable = await trajectoryFileHandle.createWritable();
            await writable.write(csvContent);
            await writable.close();
            
            alert('Notes saved successfully!');
            
            // Refresh the display to show updated status
            await displayRowDetails(author, rowNumber, parsedData.data[rowNumber - 1], parsedData.data);
        }
    } catch (error) {
        console.error('Error saving post notes:', error);
        alert('Failed to save notes. Please try again.');
    }
}            

// Function to reload the users table
async function reloadUsersTable() {
    try {
        toggleUserNotes(false); // Hide notes

        // Show all sections again
        //const selectDataFolderBtn = document.getElementById('select-data-folder-btn');
        //const appContent = document.getElementById('app-content');
        //const userSelection = document.getElementById('user-selection');
        //const statusMessage = document.getElementById('status-message');
        
        //if (selectDataFolderBtn) selectDataFolderBtn.style.display = 'block';
        //if (appContent) appContent.style.display = 'block';
        //if (userSelection) userSelection.style.display = 'block';
        //if (statusMessage) statusMessage.style.display = 'block';

        await loadUsersCSV();
    } catch (error) {
        console.error('Error reloading users table:', error);
        alert('Failed to reload users table. Please try again.');
    }
}

const style = document.createElement('style');
style.textContent = `
    .highlight-row {
        background-color: #e9ecef !important;
        transition: background-color 0.3s;
    }
`;
document.head.appendChild(style);
// Initialize the Welcome Screen
document.addEventListener('DOMContentLoaded', loadWelcomeScreen);

window.addEventListener('hashchange', restoreStateFromURL);

