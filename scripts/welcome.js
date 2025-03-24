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


async function loadChartJS() {
    if (window.Chart) return; // Skip if already loaded
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Function to show a toast message
function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: #28a745;
        color: white;
        padding: 15px 25px;
        border-radius: 5px;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease-in-out;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Fade in
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);

    // Fade out and remove
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 2000);
}

function hasDoneTag(notes) {
    if (!notes) return false;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = notes;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    return plainText.includes('!DONE!');
}

function isOnlyAssignedTag(notes) {
    if (!notes) return false;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = notes;
    const plainText = (tempDiv.textContent || tempDiv.innerText || '').trim();
    return plainText === '!ASSIGNED!';
}

// Helper function for creating truncated cells
function createTruncatedCell(text, maxLength = 50) {
    if (!text) return `<td></td>`;
    
    // Create a temporary div to parse HTML and get plain text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    
    if (plainText.length <= maxLength) {
        return `<td>${plainText}</td>`;
    }
    
    const truncated = plainText.substring(0, maxLength);
    return `
        <td>
            <div class="truncated-text">
                <div class="content">
                    <span class="short-text">${truncated}...</span>
                    <span class="full-text" style="display: none;">${plainText}</span>
                </div>
                <button class="btn btn-link btn-sm expand-btn p-0 ms-1" 
                        onclick="toggleTruncatedText(this, event)">
                    <i class="bi bi-chevron-down"></i>
                </button>
            </div>
        </td>
    `;
}

// Function to update URL state
function updateURLState(params = {}) {
    // Prevent triggering hashchange when we're already restoring state
    if (isRestoringState) return;
    
    const hash = new URLSearchParams(window.location.hash.slice(1));
    
    // Always preserve the user parameter
    if (params.user) hash.set('user', params.user);
    
    // Handle author parameter
    if (params.author) {
        hash.set('author', params.author);
        
        // Only include page if it's greater than 1
        if (params.page && params.page > 1) {
            hash.set('page', params.page);
        } else {
            hash.delete('page');
        }
        
        // Handle row parameter
        if (params.row) {
            hash.set('row', params.row);
        } else {
            hash.delete('row');
        }
    } else {
        // If no author, remove author-related parameters
        hash.delete('author');
        hash.delete('page');
        hash.delete('row');
    }
    
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
        const page = hash.get('page');

        if (user && folderHandle) {
            selectedUser = user;
            if (author) {
                if (row) {
                    // Get the data and display the specific row
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
                    
                    const rowNumber = parseInt(row);
                    if (parsedData.data[rowNumber - 1]) {
                        // Set lastViewedPost before displaying row details
                        lastViewedPost = {
                            rowNumber: rowNumber,
                            rowData: parsedData.data[rowNumber - 1],
                            page: Math.ceil(rowNumber / 30)
                        };
                        await displayRowDetails(author, rowNumber, parsedData.data[rowNumber - 1], parsedData.data);
                    }
                } else {
                    // Display the trajectory file at the specified page
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
    const userAgent = navigator.userAgent;
    const isChrome = /Chrome/.test(userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(userAgent) && /Chrome/.test(userAgent);
    
    if (!isChrome && !isEdge) {
        alert('This app is only supported in Google Chrome or Microsoft Edge. Please open the app in one of these browsers for full functionality.');
        document.body.innerHTML = '<h2 style="color: red; text-align: center;">Unsupported Browser</h2>';
        throw new Error('Unsupported browser detected. Please use Google Chrome or Microsoft Edge.');
    }
}

async function selectDataFolder() {
    try {
        // Check browser compatibility first
        const userAgent = navigator.userAgent;
        const isChrome = /Chrome/.test(userAgent) && /Google Inc/.test(navigator.vendor);
        const isEdge = /Edg/.test(userAgent) && /Chrome/.test(userAgent);
        
        if (!isChrome && !isEdge) {
            alert('This app is only supported in Google Chrome or Microsoft Edge. Please open the app in one of these browsers for full functionality.');
            document.body.innerHTML = '<h2 style="color: red; text-align: center;">Unsupported Browser</h2>';
            throw new Error('Unsupported browser detected. Please use Google Chrome or Microsoft Edge.');
        }

        // Only show directory picker if browser is compatible
        const handle = await window.showDirectoryPicker();
        
        // Check if we have the correct folder by looking for location_check.txt
        try {
            await handle.getFileHandle('location_check.txt');
        } catch (locationError) {
            console.error('Location check failed:', locationError);
            alert(`Wrong folder selected! 
                  \nPlease make sure you select the correct data folder containing 'location_check.txt'.
                  \n\nClick the Help button in the top right corner for more information.`);
            return;
        }
        
        // Only proceed if we got a valid handle and passed location check
        if (handle) {
            folderHandle = handle;
            await loadUsersFolder();
        }
    } catch (error) {
        console.error('Error selecting folder:', error);
        // Check for specific error types
        if (error.name === 'AbortError') {
            // User cancelled - do nothing
            return;
        } else if (error.name === 'SecurityError') {
            alert('Permission denied to access folder. Please try again and grant permission.');
        } else {
            alert('Error accessing folder. Please ensure you select the correct data folder.');
        }
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
            <div class="card mb-4">
                <div class="card-header">
                    <h2 class="mb-0" style="font-size: 1.5rem;">Trajectory Data for ${author}</h2>
                </div>
                <div class="card-body">
                    ${(() => {
                        const userData = usersCSVData.find(row => row.Author === author);
                        if (userData) {
                            return `
                                <div class="mb-3">
                                    <p class="mb-2"><strong>Total Posts:</strong> ${userData.TotalPosts || 'N/A'}</p>
                                    <p class="mb-2"><strong>Posts in r/conspiracy:</strong> ${userData.Conspiracy || 'N/A'}</p>
                                    <p class="mb-2"><strong>Time Between First and Last Post:</strong> ${(() => {
                                        const days = userData.DaysDifference;
                                        if (!days) return 'N/A';
                                        
                                        const years = Math.floor(days / 365);
                                        const months = Math.floor((days % 365) / 30);
                                        const remainingDays = Math.floor(days % 30);
                                        
                                        let timeString = [];
                                        if (years > 0) timeString.push(`${years} year${years > 1 ? 's' : ''}`);
                                        if (months > 0) timeString.push(`${months} month${months > 1 ? 's' : ''}`);
                                        if (remainingDays > 0) timeString.push(`${remainingDays} day${remainingDays > 1 ? 's' : ''}`);
                                        
                                        return timeString.join(', ') || '0 days';
                                    })()}</p>                                
                                </div>
                                <div class="form-group">
                                    <label for="userNotes" class="form-label">Notes on User:</label>
                                    <div class="input-group">
                                        <div class="btn-group mb-2">
                                            <button type="button" class="btn btn-sm btn-light" onclick="document.execCommand('bold', false, null)" title="Bold">
                                                <i class="bi bi-type-bold"></i>
                                            </button>
                                            <button type="button" class="btn btn-sm btn-light" onclick="document.execCommand('italic', false, null)" title="Italic">
                                                <i class="bi bi-type-italic"></i>
                                            </button>
                                            <button type="button" class="btn btn-sm btn-light" onclick="document.execCommand('underline', false, null)" title="Underline">
                                                <i class="bi bi-type-underline"></i>
                                            </button>
                                            <button type="button" class="btn btn-sm btn-light" onclick="document.execCommand('formatBlock', false, 'p')" title="Paragraph">
                                                <i class="bi bi-text-paragraph"></i>
                                            </button>
                                            <button type="button" class="btn btn-sm btn-light" onclick="formatTitle('h1')" title="Title">
                                                <i class="bi bi-type-h1"></i>
                                            </button>
                                            <button type="button" class="btn btn-sm btn-light" onclick="formatTitle('h2')" title="Subtitle">
                                                <i class="bi bi-type-h2"></i>
                                            </button>
                                            <button type="button" class="btn btn-sm btn-light" onclick="insertBulletList()" title="Bullet Point">
                                                <i class="bi bi-list-ul"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div id="userNotes" class="form-control" contenteditable="true" 
                                        style="min-height: 100px; white-space: pre-wrap;">${currentNotes}</div>
                                </div>
                                <button class="btn btn-success mt-3" onclick="saveNotes('${author}')">
                                    Save Comments On User
                                </button>
                            `;
                        }
                        return '';
                    })()}
                </div>
            </div>
        `;
    }
}

window.formatTitle = function(tag) {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const element = document.createElement(tag);
    
    // Get the selected content
    const content = range.extractContents();
    element.appendChild(content);
    
    // Insert the new element
    range.insertNode(element);
    
    // Move cursor to end of inserted element
    selection.collapse(element, element.childNodes.length);
};

// Add this helper function at the global scope:
window.insertBulletList = function() {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const list = document.createElement('ul');
    const listItem = document.createElement('li');
    listItem.appendChild(document.createElement('br'));
    list.appendChild(listItem);
    range.deleteContents();
    range.insertNode(list);
    selection.collapse(listItem, 0);
};

function openReadme() {
    const helpWindow = window.open('', 'Help', 'width=800,height=600');
    
    helpWindow.document.write(`
        <html lang="en">
        <head>
            <title>Help - Conspiracy Trajectory Analysis App</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css/github-markdown.css">
            <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
            <style>
                .markdown-body {
                    box-sizing: border-box;
                    min-width: 200px;
                    max-width: 980px;
                    margin: 0 auto;
                    padding: 45px;
                }
                @media (max-width: 767px) {
                    .markdown-body {
                        padding: 15px;
                    }
                }
            </style>
        </head>
        <body class="markdown-body">
            <div id="content"></div>
            <script>
                document.title = "Help - Conspiracy Trajectory Analysis App";
                fetch('https://raw.githubusercontent.com/constancesl/conspiracyTrajectories/main/README.md')
                    .then(response => response.text())
                    .then(text => {
                        document.getElementById('content').innerHTML = marked.parse(text);
                    })
                    .catch(error => {
                        document.getElementById('content').innerHTML = 'Error loading README: ' + error;
                    });
            </script>
        </body>
        </html>
    `);
}

// Helper function to create compact header
function createCompactHeader() {
    const topControls = document.getElementById('top-controls');
    if (topControls) {
        topControls.innerHTML = `
            <div class="container">
                <div class="d-flex justify-content-between align-items-center p-3">
                    <div class="d-flex align-items-center">
                        <a href="https://constancesl.github.io/conspiracyTrajectories/index.html" target="_blank">
                            <img src="styles/logo.png" alt="App Logo" style="height: 40px; width: auto;" class="me-3">
                        </a>
                        <h4 class="mb-0" style="line-height: 40px;">Conspiracy Trajectory Analysis App</h4>
                    </div>
                    <div class="d-flex gap-2">
                        <button id="send-data-btn" class="btn" onclick="openReadme()">
                            Help
                        </button>
                        <button id="send-data-btn" class="btn" onclick="sendUserData()">
                            Send data
                        </button>
                    </div>
                    </div>
                </div>
            </div>
        `;
    }
}

// Helper function for toggling truncated text
window.toggleTruncatedText = function(button, event) {
    event.stopPropagation();
    const container = button.closest('.truncated-text');
    const fullText = container.querySelector('.full-text');
    const shortText = container.querySelector('.short-text');
    const icon = button.querySelector('i');
    
    if (fullText.style.display === 'none') {
        shortText.style.display = 'none';
        fullText.style.display = 'inline';
        icon.classList.remove('bi-chevron-down');
        icon.classList.add('bi-chevron-up');
    } else {
        shortText.style.display = 'inline';
        fullText.style.display = 'none';
        icon.classList.remove('bi-chevron-up');
        icon.classList.add('bi-chevron-down');
    }
};

// Add this after checkBrowserCompatibility in loadWelcomeScreen
async function loadWelcomeScreen() {
    //checkBrowserCompatibility();
    
    const appContent = document.getElementById('app-content');
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const urlUser = hash.get('user');
    
    if (urlUser && folderHandle) {
        await selectUser(urlUser, true);
    } else {
        appContent.innerHTML = `
            <div class="container">
                <div class="mt-3 d-flex justify-content-end">
                    <button id="send-data-btn" class="btn" onclick="openReadme()">
                        Help
                    </button>
                </div>
                <div class="welcome-box text-center mt-3 p-5" style="background-color: #e5ebf1; border-radius: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <img src="styles/logo.png" alt="App Logo" class="mb-4" style="max-width: 150px; height: auto;">
                    <h2 class="mb-4" style="color: #333; font-weight: 600;">Conspiracy Trajectory Analysis App</h2>
                    <div">
                    <div>
                        <h6>
                            <br>
                            <span style="font-weight: bold; font-style: italic; color: #fb5743;">
                                Select the data_conspiracies folder inside the shared drive
                            </span>
                        </h6>
                        <button id="select-data-folder-btn" 
                                class="btn btn-lg mt-3 px-4 py-2"
                                onclick="checkBrowserCompatibility()">
                            <i class="bi bi-folder2-open me-2"></i>
                            Select Data Folder
                        </button>
                    </div>
                    </div>

                    <div id="user-selection" class="mt-4 d-none"></div>

                </div>
            </div>
        `;

        document.getElementById('select-data-folder-btn').addEventListener('click', selectDataFolder);
    }
}

// Add the sendUserData function
window.sendUserData = async function() {
    const progress = createProgressBarSaveData();
    const BATCH_SIZE = 5; // Process files in smaller batches
    
    try {
        if (!selectedUser) {
            progress.container.remove();
            alert('Please select a user first');
            return;
        }

        console.log('Starting data send process...');
        updateProgress(5, 'Accessing folders...');
        
        // Verify folder handles are still valid
        if (!userFolderHandle || !folderHandle) {
            throw new Error('Lost access to folders. Please reload the page and try again.');
        }

        // Collect files to update
        updateProgress(10, 'Scanning files to update...');
        const filesToUpdate = [];
        
        // Get fresh folder handles
        const dataFolderHandle = await userFolderHandle.getDirectoryHandle('Data');
        const rootDataFolderHandle = await folderHandle.getDirectoryHandle('Data');
        
        // Add users.csv first
        filesToUpdate.push({
            name: 'users.csv',
            sourcePath: 'Data',
            targetPath: 'Data'
        });

        // Get trajectory files
        const userTrajFolderHandle = await dataFolderHandle.getDirectoryHandle('TrajectoriesToAnalyse');
        for await (const entry of userTrajFolderHandle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.csv')) {
                filesToUpdate.push({
                    name: entry.name,
                    sourcePath: 'Data/TrajectoriesToAnalyse',
                    targetPath: 'Data/TrajectoriesToAnalyse'
                });
            }
        }

        const totalFiles = filesToUpdate.length;
        let processedFiles = 0;

        // Process files in batches
        for (let i = 0; i < filesToUpdate.length; i += BATCH_SIZE) {
            const batch = filesToUpdate.slice(i, i + BATCH_SIZE);
            
            // Get fresh folder handles for each batch
            const freshUserFolderHandle = await userFolderHandle.getDirectoryHandle('Data');
            const freshRootFolderHandle = await folderHandle.getDirectoryHandle('Data');
            
            for (const file of batch) {
                try {
                    const progressPercent = 15 + (processedFiles / totalFiles) * 80;
                    updateProgress(
                        progressPercent, 
                        `Updating ${file.name}... (${processedFiles + 1}/${totalFiles})`
                    );

                    // Get the appropriate folder handles based on the file path
                    let sourceFolder = freshUserFolderHandle;
                    let targetFolder = freshRootFolderHandle;
                    
                    if (file.sourcePath.includes('TrajectoriesToAnalyse')) {
                        sourceFolder = await freshUserFolderHandle.getDirectoryHandle('TrajectoriesToAnalyse');
                        targetFolder = await freshRootFolderHandle.getDirectoryHandle('TrajectoriesToAnalyse');
                    }

                    await updateCSVFile(
                        sourceFolder,
                        targetFolder,
                        file.name,
                        selectedUser
                    );
                    processedFiles++;
                } catch (error) {
                    console.error(`Error updating ${file.name}:`, error);
                    throw new Error(`Failed to update ${file.name}: ${error.message}`);
                }
            }
        }

        updateProgress(100, 'Complete!');
        setTimeout(() => {
            progress.container.remove();
            showToast('Data sent successfully!');
        }, 1000);

    } catch (error) {
        console.error('Error sending data:', error);
        progress.container.remove();
        if (error.name === 'NotReadableError') {
            alert('Lost access to files. Please reload the page and try again.');
        } else {
            alert(`Failed to send data: ${error.message}`);
        }
    }
};

async function updateCSVFile(sourceFolder, targetFolder, fileName, username) {
    let sourceFileHandle, targetFileHandle, writable;
    try {
        // Get file handles
        sourceFileHandle = await sourceFolder.getFileHandle(fileName);
        targetFileHandle = await targetFolder.getFileHandle(fileName);
        
        // Read source file
        const sourceFile = await sourceFileHandle.getFile();
        const sourceText = await sourceFile.text();
        
        // Read target file
        const targetFile = await targetFileHandle.getFile();
        const targetText = await targetFile.text();
        
        // Parse both files
        const sourceData = Papa.parse(sourceText, { header: true, skipEmptyLines: true });
        const targetData = Papa.parse(targetText, { header: true, skipEmptyLines: true });
        
        // Update target data with source data for user-specific columns
        const userColumns = [`Notes_${username}`, `Summary_${username}`];
        
        targetData.data = targetData.data.map(targetRow => {
            const sourceRow = sourceData.data.find(row => row.Author === targetRow.Author);
            if (sourceRow) {
                userColumns.forEach(column => {
                    if (sourceRow[column] !== undefined) {
                        targetRow[column] = sourceRow[column];
                    }
                });
            }
            return targetRow;
        });
        
        // Write updated data back to target file
        const csvContent = Papa.unparse(targetData.data);
        writable = await targetFileHandle.createWritable();
        await writable.write(csvContent);
        await writable.close();
        
        console.log(`${fileName} updated successfully`);
    } catch (error) {
        console.error(`Error updating ${fileName}:`, error);
        if (writable) {
            try {
                await writable.close();
            } catch (closeError) {
                console.error('Error closing writable:', closeError);
            }
        }
        throw error;
    }
}

// Select Data Folder
async function selectDataFolder() {
    try {
        // Check browser compatibility first
        const userAgent = navigator.userAgent;
        const isChrome = /Chrome/.test(userAgent) && /Google Inc/.test(navigator.vendor);
        const isEdge = /Edg/.test(userAgent) && /Chrome/.test(userAgent);
        
        if (!isChrome && !isEdge) {
            alert('This app is only supported in Google Chrome or Microsoft Edge. Please open the app in one of these browsers for full functionality.');
            document.body.innerHTML = '<h2 style="color: red; text-align: center;">Unsupported Browser</h2>';
            throw new Error('Unsupported browser detected. Please use Google Chrome or Microsoft Edge.');
        }

        // Only show directory picker if browser is compatible
        const handle = await window.showDirectoryPicker();
        
        // Check if we have the correct folder by looking for location_check.txt
        try {
            await handle.getFileHandle('location_check.txt');
        } catch (locationError) {
            console.error('Location check failed:', locationError);
            alert(`Wrong folder selected! 
                  \nPlease make sure you select the correct data folder containing 'location_check.txt'.
                  \n\nClick the Help button in the top right corner for more information.`);
            return;
        }
        
        // Only proceed if we got a valid handle and passed location check
        if (handle) {
            folderHandle = handle;
            await loadUsersFolder();
        }
    } catch (error) {
        console.error('Error selecting folder:', error);
        // Check for specific error types
        if (error.name === 'AbortError') {
            // User cancelled - do nothing
            return;
        } else if (error.name === 'SecurityError') {
            alert('Permission denied to access folder. Please try again and grant permission.');
        } else {
            alert('Error accessing folder. Please ensure you select the correct data folder.');
        }
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
            const topControls = document.getElementById('top-controls');
            topControls.innerHTML = `
                    <button id="send-data-btn" class="btn" onclick="sendUserData()">
                        Send data
                    </button>
            `;
            
            console.log(`Auto-selecting user from URL: ${urlUser}`);
            await selectUser(urlUser, true);
        } else {
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
                        class="btn btn-primary m-2 user-btn" 
                        onclick="selectUserAndUpdateButton('${user}')"
                        >                    
                    ${user}
                </button>
            `;
        });
    }

    html += '</div>';
    userSelectionDiv.innerHTML = html;
}

// Update selectUserAndUpdateButton to use createCompactHeader
window.selectUserAndUpdateButton = async function(username) {
    console.log('selectUserAndUpdateButton called with:', username);
    await selectUser(username);
    createCompactHeader();
};

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

// Create a progress bar component for saving data
function createProgressBarSaveData() {
    const progressContainer = document.createElement('div');
    progressContainer.id = 'progress-container';
    progressContainer.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        width: 300px;
        z-index: 1000;
    `;
    
    progressContainer.innerHTML = `
        <h5 class="mb-3">Sending Data...</h5>
        <div class="progress" style="height: 20px;">
            <div id="progress-bar" 
                 class="progress-bar progress-bar-striped progress-bar-animated" 
                 role="progressbar" 
                 style="width: 0%">
                0%
            </div>
        </div>
        <p id="progress-status" class="mt-2 mb-0 text-center text-muted small"></p>
    `;
    
    document.body.appendChild(progressContainer);
    
    // Add function to update progress with rounded numbers
    const updateProgress = (progress, status) => {
        const roundedProgress = Math.round(progress);
        const bar = document.getElementById('progress-bar');
        const statusEl = document.getElementById('progress-status');
        if (bar && statusEl) {
            bar.style.width = `${roundedProgress}%`;
            bar.textContent = `${roundedProgress}%`;
            statusEl.textContent = status;
        }
    };
    
    return {
        updateProgress,
        container: progressContainer
    };
}

// Create a progress bar component for creating user folder
function createProgressBarUserFolder() {
    const progressContainer = document.createElement('div');
    progressContainer.id = 'progress-container';
    progressContainer.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        width: 300px;
        z-index: 1000;
    `;
    
    progressContainer.innerHTML = `
        <h5 class="mb-3">Creating User Folder...</h5>
        <div class="progress" style="height: 20px;">
            <div id="progress-bar" 
                 class="progress-bar progress-bar-striped progress-bar-animated" 
                 role="progressbar" 
                 style="width: 0%">
                0%
            </div>
        </div>
        <p id="progress-status" class="mt-2 mb-0 text-center text-muted small"></p>
    `;
    
    document.body.appendChild(progressContainer);
    
    // Add function to update progress with rounded numbers
    const updateProgress = (progress, status) => {
        const roundedProgress = Math.round(progress);
        const bar = document.getElementById('progress-bar');
        const statusEl = document.getElementById('progress-status');
        if (bar && statusEl) {
            bar.style.width = `${roundedProgress}%`;
            bar.textContent = `${roundedProgress}%`;
            statusEl.textContent = status;
        }
    };
    
    return {
        updateProgress,
        container: progressContainer
    };
}

// Update progress bar
function updateProgress(progress, status) {
    const bar = document.getElementById('progress-bar');
    const statusEl = document.getElementById('progress-status');
    if (bar && statusEl) {
        const roundedProgress = Math.round(progress);
        bar.style.width = `${roundedProgress}%`;
        bar.textContent = `${roundedProgress}%`;
        statusEl.textContent = status;
    }
}

// Create New User Folder with better error handling
async function createNewUserFolder(username) {
    const progress = createProgressBarUserFolder();
    try {
        updateProgress(5, 'Creating user folder...');
        const userFolderHandle = await usersFolderHandle.getDirectoryHandle(username, { create: true });
        console.log(`User folder "${username}" created successfully.`);

        updateProgress(10, 'Starting data copy...');
        // Verify we still have access to the source folder
        if (!folderHandle) {
            throw new Error('Lost access to source folder. Please reload the page and try again.');
        }

        await copyDataFolder(userFolderHandle, username, progress);
        
        updateProgress(100, 'Complete!');
        setTimeout(() => {
            progress.container.remove();
            loadUsersFolder(); // Refresh the user list
        }, 1000);
    } catch (error) {
        console.error('Error creating new user folder:', error);
        progress.container.remove();
        if (error.name === 'NotReadableError') {
            alert('Lost access to files. Please reload the page and try again.');
        } else {
            alert(`Failed to create new user folder: ${error.message}`);
        }
    }
}

// Modified copy data folder function with better file handling
async function copyDataFolder(userFolderHandle, username, progress) {
    try {
        updateProgress(15, 'Getting Data folder...');
        // Verify source folder access
        const dataFolderHandle = await folderHandle.getDirectoryHandle('Data');
        const userDataFolderHandle = await userFolderHandle.getDirectoryHandle('Data', { create: true });

        // First, collect all file information
        const filesToCopy = [];
        const trajectoriesFiles = [];
        
        updateProgress(20, 'Scanning files...');
        for await (const entry of dataFolderHandle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.csv')) {
                filesToCopy.push(entry);
            } else if (entry.kind === 'directory' && entry.name === 'TrajectoriesToAnalyse') {
                const trajFolder = await dataFolderHandle.getDirectoryHandle('TrajectoriesToAnalyse');
                for await (const trajEntry of trajFolder.values()) {
                    if (trajEntry.kind === 'file') {
                        trajectoriesFiles.push(trajEntry);
                    }
                }
            }
        }

        const totalFiles = filesToCopy.length + trajectoriesFiles.length;
        let processedFiles = 0;

        // Copy main CSV files
        for (const entry of filesToCopy) {
            try {
                updateProgress(
                    25 + (processedFiles / totalFiles) * 50,
                    `Copying and modifying ${entry.name}...`
                );
                await copyAndModifyCSVFile(dataFolderHandle, userDataFolderHandle, entry.name, username);
                processedFiles++;
            } catch (error) {
                console.error(`Error copying file ${entry.name}:`, error);
                throw new Error(`Failed to copy ${entry.name}: ${error.message}`);
            }
        }

        // Copy trajectories
        if (trajectoriesFiles.length > 0) {
            updateProgress(75, 'Creating trajectories folder...');
            const userTrajectoriesHandle = await userDataFolderHandle.getDirectoryHandle('TrajectoriesToAnalyse', { create: true });
            
            for (const entry of trajectoriesFiles) {
                try {
                    updateProgress(
                        80 + (processedFiles / totalFiles) * 15,
                        `Copying trajectory file ${entry.name}...`
                    );
                    const sourceFile = await entry.getFile();
                    const targetFileHandle = await userTrajectoriesHandle.getFileHandle(entry.name, { create: true });
                    const writable = await targetFileHandle.createWritable();
                    await writable.write(await sourceFile.arrayBuffer());
                    await writable.close();
                    processedFiles++;
                } catch (error) {
                    console.error(`Error copying trajectory file ${entry.name}:`, error);
                    throw new Error(`Failed to copy trajectory file ${entry.name}: ${error.message}`);
                }
            }
        }

        updateProgress(95, 'Finalizing...');
        console.log('Data folder and TrajectoriesToAnalyse folder copied successfully.');
    } catch (error) {
        console.error('Error copying Data folder:', error);
        throw error;
    }
}

// Modified copy and modify CSV file function
async function copyAndModifyCSVFile(sourceFolderHandle, targetFolderHandle, fileName, username) {
    try {
        const fileHandle = await sourceFolderHandle.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        const text = await file.text();
        
        const parsedData = Papa.parse(text, { 
            header: true,
            skipEmptyLines: true
        });

        // Filter out any existing Notes_ or Summary_ columns
        const cleanedFields = parsedData.meta.fields.filter(field => 
            !field.startsWith('Notes_') && !field.startsWith('Summary_')
        );

        // Add new columns for current user
        const notesColumn = `Notes_${username}`;
        const summaryColumn = `Summary_${username}`;
        cleanedFields.push(notesColumn, summaryColumn);

        // Create cleaned data with only the desired columns
        const cleanedData = parsedData.data.map(row => {
            const cleanedRow = {};
            cleanedFields.forEach(field => {
                if (field === notesColumn || field === summaryColumn) {
                    cleanedRow[field] = ''; // Initialize new columns as empty
                } else {
                    cleanedRow[field] = row[field]; // Copy existing data
                }
            });
            return cleanedRow;
        });

        // Filter out empty rows
        const filteredData = cleanedData.filter(row => 
            Object.values(row).some(value => value !== '')
        );
        
        // Create new file with modified content
        const newFileHandle = await targetFolderHandle.getFileHandle(fileName, { create: true });
        const writable = await newFileHandle.createWritable();
        const csvContent = Papa.unparse({
            fields: cleanedFields,
            data: filteredData
        }, {
            header: true,
            newline: '\n'
        }).trim();
        
        await writable.write(csvContent);
        await writable.close();

        console.log(`CSV file "${fileName}" copied and modified successfully.`);
    } catch (error) {
        console.error(`Error copying and modifying CSV file "${fileName}":`, error);
        throw error;
    }
}


// Modified copy trajectories folder function
async function copyTrajectoriesFolder(sourceHandle, targetHandle, username, progress, totalFiles, processedFiles) {
    for await (const entry of sourceHandle.values()) {
        if (entry.kind === 'file') {
            updateProgress(
                80 + (processedFiles / totalFiles) * 15,
                `Copying trajectory file ${entry.name}...`
            );
            const sourceFile = await entry.getFile();
            const targetFileHandle = await targetHandle.getFileHandle(entry.name, { create: true });
            const writable = await targetFileHandle.createWritable();
            await writable.write(await sourceFile.arrayBuffer());
            await writable.close();
            processedFiles++;
        }
    }
}


// Function to initialize or update the send button
function updateSendButton() {
    console.log('updateSendButton called, selectedUser:', selectedUser);
    
    const topControls = document.getElementById('top-controls');
    if (!topControls) {
        console.error('top-controls div not found');
        return;
    }

    if (selectedUser) {
        console.log('Adding send button for user:', selectedUser);
        createCompactHeader();
    } else {
        console.log('No user selected, showing placeholder');
        topControls.innerHTML = '<span>Waiting for user...</span>';
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
        
        // Clear the welcome screen
        const appContent = document.getElementById('app-content');
        appContent.innerHTML = '<div id="user-selection" class="mt-4"></div>';

        // Create compact header
        createCompactHeader();
        // Set sessionStorage
        sessionStorage.setItem('selectedUser', selectedUser);

        // Access user's folder and load data
        await accessUserFolder();
        await loadUsersCSV();

        // Add another call here in case the first one was too early
        updateSendButton();

        // If we're restoring state and have an author parameter, load that trajectory
        if (isRestoring) {
            updateSendButton();
            const hash = new URLSearchParams(window.location.hash.slice(1));
            const author = hash.get('author');
            const row = hash.get('row');
            
            if (author && usersCSVData && usersCSVData.length > 0) {
                // Add a small delay to ensure everything is loaded
                setTimeout(async () => {
                    try {
                        if (row) {
                            // Get the data and display the specific row
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
                            
                            const rowNumber = parseInt(row);
                            if (parsedData.data[rowNumber - 1]) {
                                // Set lastViewedPost before displaying row details
                                lastViewedPost = {
                                    rowNumber: rowNumber,
                                    rowData: parsedData.data[rowNumber - 1],
                                    page: Math.ceil(rowNumber / 30)
                                };
                                await displayRowDetails(author, rowNumber, parsedData.data[rowNumber - 1], parsedData.data);
                            }
                        } else {
                            await displayTrajectoryFile(author, true);
                        }
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
        <div class="table-container">
            <div class="table-header d-flex justify-content-between align-items-center">
                <h5>Users Dataset</h5>
                <div class="d-flex align-items-center gap-2">
                    <label for="sortSelect" class="text-white mb-0">Sort by:</label>
                    <select id="sortSelect" class="form-select form-select-sm" style="width: auto;">
                        ${fields.map(field => {
                            const displayName = field.startsWith('Notes_') ? 'Notes' : 
                                              (columnDisplayNames[field] || field);
                            return `<option value="${field}">${displayName}</option>`;
                        }).join('')}
                    </select>
                    <button id="sortDirection" class="btn btn-sm btn-light">
                        <i class="bi bi-arrow-down"></i>
                    </button>
                </div>
            </div>
            <div class="table-responsive">
                <table id="users-table" class="table">
                    <thead>
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

    // Create rows with conditional formatting
    // Inside displayUsersTable, update the row creation part:
    data.forEach(row => {
        if (row && typeof row === 'object') {
            const notesField = fields.find(field => field.startsWith('Notes_'));
        const summaryField = fields.find(field => field.startsWith('Summary_'));
        const notes = notesField ? row[notesField] : '';
        const summaryValue = summaryField ? row[summaryField] : '';
        
        // Determine row class based on multiple conditions
        let rowClass;
        if (window.hasDoneTag(notes)) {
            rowClass = 'table-success';
        } else if (window.isOnlyAssignedTag(notes)) {
            rowClass = 'table-danger';
        } else if (summaryValue === 'Notes saved') {
            rowClass = 'table-warning';
        } else {
            rowClass = '';
        }

        tableHTML += `
            <tr class="${rowClass}" style="cursor: pointer;" 
                onclick="displayTrajectoryFile('${row.Author}')" 
                title="Click to view trajectory file">`;
        
        fields.forEach(field => {
            if (field === 'DaysDifference') {
                const days = row[field];
                if (!days && days !== 0) {
                    tableHTML += '<td>N/A</td>';
                } else {
                    const years = Math.floor(days / 365);
                    const months = Math.floor((days % 365) / 30);
                    const remainingDays = Math.floor(days % 30);
                    
                    let timeString = [];
                    if (years > 0) timeString.push(`${years}y`);
                    if (months > 0) timeString.push(`${months}m`);
                    if (remainingDays > 0) timeString.push(`${remainingDays}d`);
                    
                    tableHTML += `<td>${timeString.join(', ') || '0d'}</td>`;
                }
            } else if (field.startsWith('Notes_')) {
                tableHTML += window.createTruncatedCell(row[field]);
            } else {
                const value = row[field];
                tableHTML += `<td>${value !== undefined && value !== null ? value : ''}</td>`;
            }
            });
            tableHTML += '</tr>';
        }
    });
            

    tableHTML += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    filePreviewDiv.innerHTML = tableHTML;

    // Add sorting functionality
    const sortSelect = document.getElementById('sortSelect');
    const sortDirection = document.getElementById('sortDirection');
    let isAscending = true;

    function sortTable() {
        const field = sortSelect.value;
        const tbody = document.querySelector('#users-table tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));

        rows.sort((a, b) => {
            let aVal = a.children[fields.indexOf(field)].textContent;
            let bVal = b.children[fields.indexOf(field)].textContent;

            if (field === 'TotalPosts' || field === 'Conspiracy' || field === 'DaysDifference') {
                aVal = parseFloat(aVal) || 0;
                bVal = parseFloat(bVal) || 0;
            }

            if (aVal < bVal) return isAscending ? -1 : 1;
            if (aVal > bVal) return isAscending ? 1 : -1;
            return 0;
        });

        tbody.innerHTML = '';
        rows.forEach(row => tbody.appendChild(row));
    }

    sortSelect.addEventListener('change', sortTable);
    sortDirection.addEventListener('click', () => {
        isAscending = !isAscending;
        sortDirection.innerHTML = `<i class="bi bi-arrow-${isAscending ? 'down' : 'up'}"></i>`;
        sortTable();
    });

    sortTable();
}

// Add this function at the global scope
window.toggleTruncatedText = function(button, event) {
    event.preventDefault();
    event.stopPropagation();
    
    const content = button.parentElement.querySelector('.content');
    const shortText = content.querySelector('.short-text');
    const fullText = content.querySelector('.full-text');
    const icon = button.querySelector('i');
    
    if (fullText.style.display === 'none') {
        shortText.style.display = 'none';
        fullText.style.display = 'block';
        icon.classList.remove('bi-chevron-down');
        icon.classList.add('bi-chevron-up');
    } else {
        shortText.style.display = 'block';
        fullText.style.display = 'none';
        icon.classList.remove('bi-chevron-up');
        icon.classList.add('bi-chevron-down');
    }
};

// Add this function to create and display the trajectory graph
async function displayTrajectoryGraph(author) {
    try {
        await loadChartJS();
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

        // Process all data formats upfront
        const postsByMonth = processPostingFrequency(parsedData.data, 'month');
        const postsByYear = processPostingFrequency(parsedData.data, 'year');
        const postsByDay = processPostingFrequency(parsedData.data, 'day');
        
        // Get unique years for the dropdown
        const years = [...new Set(parsedData.data.map(post => post.year))].sort();
        
        // Create modal with controls
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'trajectoryGraphModal';
        modal.innerHTML = `
            <div class="modal-dialog modal-xl" style="max-width: 90vw;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Posting Activity for ${author}</h5>
                        <div class="d-flex gap-3 align-items-center">
                            <div class="btn-group">
                                <button class="btn btn-outline-primary active" data-view="month">Monthly</button>
                                <button class="btn btn-outline-primary" data-view="year">Yearly</button>
                                <button class="btn btn-outline-primary" data-view="day">Daily</button>
                            </div>
                            <select id="yearSelect" class="form-select" style="display: none;">
                                ${years.map(year => `<option value="${year}">${year}</option>`).join('')}
                            </select>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                    </div>
                    <div class="modal-body">
                        <div style="height: 500px; overflow-x: auto;">
                            <div style="min-width: 1200px; height: 100%;">
                                <canvas id="trajectoryChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();

        let currentChart = null;

        function createChart(type, data) {
            if (currentChart) {
                currentChart.destroy();
            }
        
            // Helper function to format the view type
            function formatViewType(type) {
                const viewTypes = {
                    'day': 'Daily',
                    'month': 'Monthly',
                    'year': 'Yearly'
                };
                return viewTypes[type] || type.charAt(0).toUpperCase() + type.slice(1);
            }
        
            const ctx = document.getElementById('trajectoryChart').getContext('2d');
            currentChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: `Posts per ${formatViewType(type)}`,
                        data: data.counts,
                        backgroundColor: '#4c8c8c',
                        borderColor: '#284949',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Number of Posts'
                            },
                            ticks: { stepSize: 1 }
                        },
                        x: {
                            title: {
                                display: true,
                                text: formatViewType(type)
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: `Posting Frequency (${formatViewType(type)} View)`,
                            padding: 20,
                            font: { size: 16 }
                        },
                        legend: { position: 'bottom' }
                    }
                }
            });
        }

        // Event listeners for view changes
        const viewButtons = modal.querySelectorAll('[data-view]');
        const yearSelect = modal.querySelector('#yearSelect');

        viewButtons.forEach(button => {
            button.addEventListener('click', () => {
                viewButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                const view = button.dataset.view;
                yearSelect.style.display = view === 'day' ? 'block' : 'none';
                
                if (view === 'day') {
                    const yearData = postsByDay[yearSelect.value];
                    createChart('day', yearData);
                } else if (view === 'month') {
                    createChart('month', postsByMonth);
                } else {
                    createChart('year', postsByYear);
                }
            });
        });

        yearSelect.addEventListener('change', () => {
            const yearData = postsByDay[yearSelect.value];
            createChart('day', yearData);
        });

        // Initial chart
        createChart('month', postsByMonth);

        // Cleanup
        modal.addEventListener('hidden.bs.modal', () => {
            if (currentChart) {
                currentChart.destroy();
            }
            document.body.removeChild(modal);
        });

    } catch (error) {
        console.error('Error creating trajectory graph:', error);
        alert('Failed to create trajectory graph. Please try again.');
    }
}

// Updated processing function to handle different time scales and empty periods
function processPostingFrequency(data, timeScale = 'month') {
    const posts = new Map();
    const monthMap = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };

    // Helper function to process gaps in any time series
    function processGaps(entries) {
        const processedDates = [];
        let emptyCount = 0;
        let lastNonEmptyIndex = -1;

        entries.forEach((entry, index) => {
            if (entry[1] === 0) {
                emptyCount++;
                if (emptyCount === 3 && index < entries.length - 1) {
                    processedDates.push(['...', null]);
                }
            } else {
                if (emptyCount <= 5 || lastNonEmptyIndex === -1) {
                    // Add skipped empty dates
                    for (let i = 0; i < emptyCount; i++) {
                        processedDates.push(entries[index - emptyCount + i]);
                    }
                }
                processedDates.push(entry);
                lastNonEmptyIndex = processedDates.length - 1;
                emptyCount = 0;
            }
        });

        return processedDates;
    }

    if (timeScale === 'day') {
        // Process daily data by year
        const postsByYear = {};
        
        data.forEach(post => {
            if (post.year && post.day_month) {
                const [day, monthStr] = post.day_month.split(' ');
                const month = monthMap[monthStr];
                const date = `${post.year}-${month}-${day.padStart(2, '0')}`;
                
                if (!postsByYear[post.year]) {
                    postsByYear[post.year] = new Map();
                }
                postsByYear[post.year].set(date, (postsByYear[post.year].get(date) || 0) + 1);
            }
        });

        // Process each year's data
        Object.keys(postsByYear).forEach(year => {
            const yearData = postsByYear[year];
            const sortedDates = Array.from(yearData.keys()).sort();
            
            // Fill in missing days
            const start = new Date(sortedDates[0]);
            const end = new Date(sortedDates[sortedDates.length - 1]);
            
            const allDates = [];
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                allDates.push([dateStr, yearData.get(dateStr) || 0]);
            }

            // Process gaps in daily data
            const processedDates = processGaps(allDates);
            
            postsByYear[year] = {
                labels: processedDates.map(([date]) => 
                    date === '...' ? date : new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
                counts: processedDates.map(([, count]) => count)
            };
        });

        return postsByYear;
    }

    // Process monthly or yearly data
    data.forEach(post => {
        if (post.year && post.day_month) {
            const [day, monthStr] = post.day_month.split(' ');
            const month = monthMap[monthStr];
            
            let key;
            if (timeScale === 'month') {
                key = `${post.year}-${month}`;
            } else {
                key = `${post.year}`;
            }
            
            posts.set(key, (posts.get(key) || 0) + 1);
        }
    });

    // Fill in empty periods
    const sortedEntries = Array.from(posts.entries()).sort();
    if (sortedEntries.length > 0) {
        const [startDate] = sortedEntries[0];
        const [endDate] = sortedEntries[sortedEntries.length - 1];
        
        const allDates = [];
        
        if (timeScale === 'month') {
            const [startYear, startMonth] = startDate.split('-').map(Number);
            const [endYear, endMonth] = endDate.split('-').map(Number);
            
            let currentYear = startYear;
            let currentMonth = startMonth;
            
            while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
                const key = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
                allDates.push([key, posts.get(key) || 0]);
                
                currentMonth++;
                if (currentMonth > 12) {
                    currentMonth = 1;
                    currentYear++;
                }
            }
        } else { // year view
            const startYear = parseInt(startDate);
            const endYear = parseInt(endDate);
            
            for (let year = startYear; year <= endYear; year++) {
                allDates.push([String(year), posts.get(String(year)) || 0]);
            }
        }

        const processedDates = processGaps(allDates);

        return {
            labels: processedDates.map(([date]) => {
                if (date === '...') return date;
                if (timeScale === 'month') {
                    const [year, month] = date.split('-');
                    return `${Object.keys(monthMap)[Number(month) - 1]} ${year}`;
                }
                return date;
            }),
            counts: processedDates.map(([, count]) => count)
        };
    }

    return {
        labels: sortedEntries.map(([date]) => date),
        counts: sortedEntries.map(([, count]) => count)
    };
}


// Display Trajectory File
async function displayTrajectoryFile(author, isRestoring = false) {
    console.log('Starting displayTrajectoryFile with:', { author, isRestoring });
    
    try {
        // Get current URL parameters
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const urlRow = hash.get('row');
        const urlPage = parseInt(hash.get('page')) || 1;

        toggleUserNotes(true, author);

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

        // If we have a row parameter but no lastViewedPost, restore it
        if (urlRow && !lastViewedPost) {
            const rowNumber = parseInt(urlRow);
            const page = Math.ceil(rowNumber / 30);
            
            if (parsedData.data[rowNumber - 1]) {
                lastViewedPost = {
                    rowNumber: rowNumber,
                    rowData: parsedData.data[rowNumber - 1],
                    page: page
                };
            }
        }

        // Pagination settings
        const rowsPerPage = 30;
        const currentPage = urlPage;
        const totalPages = Math.ceil(parsedData.data.length / rowsPerPage);
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const currentData = parsedData.data.slice(startIndex, endIndex);

        if (!isRestoring) {
            updateURLState({ 
                user: selectedUser, 
                author: author,
                page: currentPage > 1 ? currentPage : null
            });
        }

        // Selected columns for display
        const selectedColumns = ['year', 'day_month', 'title', `Notes_${selectedUser}`, `Summary_${selectedUser}`];
        const columnNames = ['#', 'Year', 'Date', 'Title', 'Notes', 'Status'];

        // Create HTML for trajectory view
        const filePreviewDiv = document.getElementById('file-preview');
        filePreviewDiv.innerHTML = `
            <style>
                .trajectory-table th:first-child,
                .trajectory-table td:first-child {
                    width: auto;
                    min-width: fit-content;
                    text-align: center;
                }
                .trajectory-table th:nth-child(2),
                .trajectory-table td:nth-child(2) {
                    width: auto;
                    min-width: fit-content;
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
            <div style="position: sticky; top: 0; background-color: #f8f9fa; padding: 15px 0 25px 0; z-index: 1000; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div class="container">
                    <div class="d-flex justify-content-between align-items-center">
                        <h3>List of Posts for ${author}</h3>
                        <div class="btn-group gap-2">
                            <button class="btn btn-primary" onclick="reloadUsersTable()">
                                ← Back to Users Table
                            </button>
                            <button class="btn btn-primary" onclick="displayTrajectoryGraph('${author}')">
                                📊 View Activity Graph
                            </button>
                            ${lastViewedPost ? `
                                <button class="btn btn-primary" 
                                    onclick="displayRowDetails('${author}', ${lastViewedPost.rowNumber}, ${JSON.stringify(lastViewedPost.rowData).replace(/"/g, '&quot;')})">
                                    Return to Row ${lastViewedPost.rowNumber} →
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <div class="table-container">
                <div class="table-header d-flex justify-content-between align-items-center">
                    <h5>Trajectory Data</h5>
                    <span class="text-white">
                        Showing ${startIndex + 1}-${Math.min(endIndex, parsedData.data.length)} 
                        of ${parsedData.data.length} posts
                    </span>
                </div>
                <div class="table-responsive">
                    <table class="table trajectory-table">
                        <thead>
                            <tr>
                                ${columnNames.map(name => `<th>${name}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                        ${currentData.map((row, index) => {
                            const absoluteIndex = startIndex + index;
                            const notes = row[`Notes_${selectedUser}`];
                            const summaryValue = row[`Summary_${selectedUser}`];
                            
                            // Determine row class based on multiple conditions
                            let rowClass;
                            if (window.hasDoneTag(notes)) {
                                rowClass = 'table-success';
                            } else if (summaryValue === 'Notes saved') {
                                rowClass = 'table-warning'; 
                            } else if (window.isOnlyAssignedTag(notes)) {
                                rowClass = 'table-danger';
                            } else {
                                rowClass = '';
                            }
                        
                            return `
                                <tr class="${rowClass}" style="cursor: pointer;" 
                                    onclick="displayRowDetails('${author}', ${absoluteIndex + 1}, ${JSON.stringify(row).replace(/"/g, '&quot;')})">
                                    <td>${absoluteIndex + 1}</td>
                                    <td>${row.year || ''}</td>
                                    <td>${row.day_month || ''}</td>
                                    <td>${row.title || ''}</td>
                                    ${window.createTruncatedCell(notes)}
                                    <td>${summaryValue || ''}</td>
                                </tr>
                            `;
                        }).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="pagination-controls d-flex justify-content-between align-items-center p-3">
                    <div class="btn-group">
                        ${currentPage > 1 ? `
                            <button class="btn btn-primary" 
                                onclick="navigateTrajectoryPage('${author}', ${currentPage - 1})">
                                ← Previous
                            </button>
                        ` : ''}
                        ${currentPage < totalPages ? `
                            <button class="btn btn-primary ms-2" 
                                onclick="navigateTrajectoryPage('${author}', ${currentPage + 1})">
                                Next →
                            </button>
                        ` : ''}
                    </div>
                    <span class="page-info">
                        Page ${currentPage} of ${totalPages}
                    </span>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error displaying trajectory file:', error);
        alert(`Could not display trajectory file for  ${author}. Please ensure the file exists in the TrajectoriesToAnalyse folder.`);
    }
}

// Add the saveNotes function to handle saving
window.saveNotes = async function(author) {
    try {
        // Change from .value to .innerHTML since we're using a contenteditable div
        const newNotes = document.getElementById('userNotes').innerHTML;
                
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
            
            showToast('Notes saved successfully!');
        }
    } catch (error) {
        console.error('Error saving notes:', error);
        alert('Failed to save notes. Please try again.');
    }
};

// Navigation function
function navigateTrajectoryPage(author, page) {
    updateURLState({ 
        user: selectedUser, 
        author: author,
        page: page > 1 ? page : null
    });
    displayTrajectoryFile(author, true);
}

// Open a specific row in the trajectory file
async function displayRowDetails(author, rowNumber, rowData, allData) {
    try {
        // Calculate the page number for this row
        const rowsPerPage = 30;
        const page = Math.ceil(rowNumber / rowsPerPage);
        
        // Save the last viewed post with absolute row number
        lastViewedPost = {
            rowNumber: rowNumber,
            rowData: rowData,
            page: page
        };

        // Update URL with both page and row
        updateURLState({ 
            user: selectedUser, 
            author: author,
            page: page > 1 ? page : null,
            row: rowNumber 
        });

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

        const filePreviewDiv = document.getElementById('file-preview');
        if (!filePreviewDiv) {
            console.error('file-preview element not found');
            return; // Silently return without showing an alert
        }

        filePreviewDiv.innerHTML = `
            <div style="position: sticky; top: 0; background-color: #f8f9fa; padding: 15px 0 25px 0; z-index: 1000; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div class="container">
                    <div class="d-flex justify-content-between align-items-center">
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
                </div>
            </div>

            <div class="row mb-4">
                <!-- Notes Section -->
                <div class="col-md-6 mb-3">
                    <div class="card h-100">
                        <div class="card-header">
                            <h5 class="card-title mb-0">Notes on Post</h5>
                        </div>
                        <div class="card-body">
                            <div class="input-group">
                                <div class="btn-group mb-2">
                                    <button type="button" class="btn btn-sm btn-light" onclick="document.execCommand('bold', false, null)" title="Bold">
                                        <i class="bi bi-type-bold"></i>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-light" onclick="document.execCommand('italic', false, null)" title="Italic">
                                        <i class="bi bi-type-italic"></i>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-light" onclick="document.execCommand('underline', false, null)" title="Underline">
                                        <i class="bi bi-type-underline"></i>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-light" onclick="document.execCommand('formatBlock', false, 'p')" title="Paragraph">
                                        <i class="bi bi-text-paragraph"></i>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-light" onclick="formatTitle('h1')" title="Title">
                                        <i class="bi bi-type-h1"></i>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-light" onclick="formatTitle('h2')" title="Subtitle">
                                        <i class="bi bi-type-h2"></i>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-light" onclick="insertBulletList()" title="Bullet Point">
                                        <i class="bi bi-list-ul"></i>
                                    </button>
                                </div>
                            </div>
                            <div id="postNotes" class="form-control" contenteditable="true" 
                                style="min-height: 150px; white-space: pre-wrap;">${rowData[`Notes_${selectedUser}`] || ''}</div>
                            <button class="btn btn-success mt-2" 
                                onclick="savePostNotes('${author}', ${rowNumber})">
                                Save Comments on Post
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Summary Section -->
                <div class="col-md-6 mb-3">
                    <div class="card h-100">
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
            <div class="card">
                <div class="card-header">
                    <div class="d-flex justify-content-between align-items-center">
                        <h4 class="card-title mb-0">Post title</h4>
                        <div>
                            ${(() => {
                                const url = rowData.url || '';
                                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                                return url !== rowData.permalink && !isImage ? `
                                    <a href="${url}" class="btn btn-primary me-2" target="_blank"
                                        style="border: 2px solid white !important;">
                                        Linked content
                                    </a>
                                ` : '';
                            })()}
                            <a href="${rowData.permalink}" class="btn btn-primary me-2" target="_blank" 
                               style="border: 2px solid white !important;">
                                Open in Reddit
                            </a>
                            <button class="btn btn-primary" onclick="openGuidelines()"
                               style="border: 2px solid white !important;">
                                Guidelines
                            </button>
                        </div>
                    </div>
                    <div class="mt-2">
                        <p class="mb-0 ps-3 fs-5" style="font-weight: 400; padding-right: 23%;">${rowData.title}</p>
                    </div>
                </div>
                <div class="card-body">
                    ${(() => {
                        let content = '';
                        const hasSelftext = rowData.selftext && rowData.selftext.trim() !== '';
                        const url = rowData.url || '';
                        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                        const isVideo = /\.(mp4|webm)$/i.test(url);
                        const hasMedia = isImage || isVideo;
                        
                        // Create row if we have both text and media
                        if (hasSelftext && hasMedia) {
                            content += `<div class="row g-4">`;
                        }
                        
                        // Add selftext in a column if needed
                        if (hasSelftext) {
                            content += `
                                <div class="${hasMedia ? 'col-md-6' : ''}">
                                    <div class="p-4 rounded">
                                        <div style="white-space: pre-line;">
                                            ${rowData.selftext.replace(/\n/g, '<br>')}
                                        </div>
                                        
                                        ${(() => {
                                            // Extract both Markdown-style links and plain URLs
                                            const markdownLinks = rowData.selftext.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
                                            const plainUrls = rowData.selftext.match(/https?:\/\/[^\s<>"']+(?:\([^)]*\))?/g) || [];
                                            
                                            // Process Markdown links
                                            const markdownProcessed = markdownLinks.map(link => {
                                                const match = link.match(/\[([^\]]+)\]\(([^)]+)\)/);
                                                if (match) {
                                                    return {
                                                        text: match[1],
                                                        url: match[2]
                                                    };
                                                }
                                                return null;
                                            }).filter(Boolean);

                                            // Process plain URLs
                                            const plainProcessed = plainUrls
                                                .filter(url => !markdownLinks.some(link => link.includes(url)))
                                                .map(url => ({
                                                    text: 'Open text link',
                                                    url: url.replace(/\([^)]*\)$/, '')
                                                }));

                                            const allLinks = [...markdownProcessed, ...plainProcessed];

                                            if (allLinks.length > 0) {
                                                return `
                                                    <div class="mt-3 pt-3 border-top">
                                                        ${allLinks.map((link, index) => `
                                                            <a href="${link.url}" 
                                                               class="btn btn-primary btn-sm me-2 mb-2" 
                                                               target="_blank">
                                                                ${allLinks.length > 1 ? `${link.text} ${index + 1}` : link.text}
                                                            </a>
                                                        `).join('')}
                                                    </div>
                                                `;
                                            }
                                            return '';
                                        })()}
                                    </div>
                                </div>
                            `;
                        }
                        
                        // Add media in a column if needed
                        if (hasMedia) {
                            content += `
                                <div class="${hasSelftext ? 'col-md-6' : ''}">
                                    ${isImage ? `
                                        <div class="text-center">
                                            <a href="${url}" target="_blank" title="Click to open full image in new tab">
                                                <img src="${url}" 
                                                     class="img-fluid" 
                                                     style="max-height: 600px; width: 100%; object-fit: contain; cursor: pointer;" 
                                                     alt="Content image">
                                            </a>
                                            <div class="text-muted small mt-1">
                                                <i class="bi bi-arrows-fullscreen"></i> Click image to open in full size
                                            </div>
                                        </div>
                                    ` : `
                                        <video controls class="w-100">
                                            <source src="${url}" type="video/${url.split('.').pop()}">
                                            Your browser does not support the video tag.
                                        </video>
                                    `}
                                </div>
                            `;
                        }
                        
                        // Close row if we opened one
                        if (hasSelftext && hasMedia) {
                            content += `</div>`;
                        }
                        
                        return content || '<p class="text-muted">No preview available</p>';
                    })()}
                </div>
            </div>

            <!-- Conspiracy Analysis Section -->
            <div class="card mt-4">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="card-title mb-0">Conspiracy Analysis</h5>
                    <button class="btn btn-outline-primary btn-sm" onclick="openGuidelines()">
                        <i class="bi bi-book"></i> Guidelines
                    </button>
                </div>
                <div class="card-body">
                    <form id="conspiracyAnalysisForm">
                        <div class="row">
                            <!-- First Row: Topics and Sources -->
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Topics</label>
                                    <select class="form-select" multiple id="topics" style="height: 150px;">
                                        <option value="American Politics & Government">American Politics & Government</option>
                                        <option value="Aliens & Extraterrestrial Life">Aliens & Extraterrestrial Life</option>
                                        <option value="Media Control & Censorship">Media Control & Censorship</option>
                                        <option value="Global Elites & Secret Societies">Global Elites & Secret Societies</option>
                                        <option value="Health & Medical">Health & Medical</option>
                                        <option value="Technology & Surveillance">Technology & Surveillance</option>
                                        <option value="Environmental Issues">Environmental Issues</option>
                                        <option value="Financial & Economic">Financial & Economic</option>
                                        <option value="Historical Events">Historical Events</option>
                                        <option value="Religious & Spiritual">Religious & Spiritual</option>
                                        <option value="Science & Research">Science & Research</option>
                                        <option value="Social Control & Mind Control">Social Control & Mind Control</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Sources Used</label>
                                    <select class="form-select" multiple id="sourcesUsed" style="height: 150px;">
                                        <option value="Mainstream News Articles">Mainstream News Articles</option>
                                        <option value="Alternative & Fringe News Sites">Alternative & Fringe News Sites</option>
                                        <option value="YouTube Videos from unverified users">YouTube Videos from unverified users</option>
                                        <option value="YouTube Videos from official channels">YouTube Videos from official channels</option>
                                        <option value="Blogs and Personal Websites">Blogs and Personal Websites</option>
                                        <option value="Social Media Posts">Social Media Posts</option>
                                        <option value="Leaked Documents & WikiLeaks">Leaked Documents & WikiLeaks</option>
                                        <option value="Memes and Infographics">Memes and Infographics</option>
                                        <option value="Forums and Imageboards">Forums and Imageboards</option>
                                        <option value="Documentaries and Pseudo-Documentaries">Documentaries and Pseudo-Documentaries</option>
                                        <option value="Personal Testimonies and Anecdotes">Personal Testimonies and Anecdotes</option>
                                        <option value="Other">Other</option>
                                        <option value="No sources">No sources</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Second Row: Specific Topic and Belief -->
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Specific Topic</label>
                                    <input type="text" class="form-control" id="specificTopic" value="${rowData[`SpecificTopic_${selectedUser}`] || ''}">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label mt-2">Comments on Sources</label>
                                    <textarea class="form-control" id="sourceComments" rows="2">${rowData[`SourceComments_${selectedUser}`] || ''}</textarea>
                                </div>
                            </div>

                            <!-- Third Row: Reactions -->
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Reactions in Comments</label>
                                    <select class="form-select" id="commentReactions">
                                        <option value="None">None</option>
                                        <option value="Supportive">Supportive</option>
                                        <option value="Doubtful">Doubtful</option>
                                        <option value="Hostile">Hostile</option>
                                        <option value="Mixed">Mixed</option>
                                        <option value="Unclear">Unclear</option>
                                    </select>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Degree of Belief</label>
                                    <select class="form-select" id="beliefDegree">
                                        <option value="Strong Disbelief">Strong Disbelief</option>
                                        <option value="Disbelief">Disbelief</option>
                                        <option value="Neutral">Neutral</option>
                                        <option value="Belief">Belief</option>
                                        <option value="Strong Belief">Strong Belief</option>
                                        <option value="Unclear">Unclear</option>
                                    </select>
                                </div>
                            </div>      
                            <!-- Fourth Row: Comments -->
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label mt-2">Comments on Degree of Belief</label>
                                    <textarea class="form-control" id="beliefComments" rows="2">${rowData[`BeliefComments_${selectedUser}`] || ''}</textarea>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label mt-2">Comments on Reactions</label>
                                    <textarea class="form-control" id="reactionComments" rows="2">${rowData[`ReactionComments_${selectedUser}`] || ''}</textarea>
                                </div>
                            </div>                                

                            <!-- Save Button -->
                            <div class="text-center mt-3">
                                <button type="button" class="btn btn-success" onclick="saveConspiracyAnalysis('${author}', ${rowNumber})">
                                    Save Analysis
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Load saved values after the form is rendered
        const topicSelect = document.getElementById('topicSelect');
        const beliefDegree = document.getElementById('beliefDegree');
        const commentReactions = document.getElementById('commentReactions');
        const sourcesUsed = document.getElementById('sourcesUsed');

        // Load topics
        const savedTopics = rowData[`Topics_${selectedUser}`]?.split('; ') || [];
        Array.from(topicSelect.options).forEach(option => {
            if (savedTopics.includes(option.value)) {
                option.selected = true;
            }
        });

        // Load belief degree
        const savedBeliefDegree = rowData[`BeliefDegree_${selectedUser}`];
        if (savedBeliefDegree) {
            beliefDegree.value = savedBeliefDegree;
        }

        // Load comment reactions
        const savedCommentReactions = rowData[`CommentReactions_${selectedUser}`];
        if (savedCommentReactions) {
            commentReactions.value = savedCommentReactions;
        }

        // Load sources
        const savedSources = rowData[`SourcesUsed_${selectedUser}`]?.split('; ') || [];
        Array.from(sourcesUsed.options).forEach(option => {
            if (savedSources.includes(option.value)) {
                option.selected = true;
            }
        });

    } catch (error) {
        console.error('Error displaying row details:', error);
        // Only show alert for critical errors that prevent the row from displaying
        if (!error.message.includes('file-preview element') && 
            !error.message.includes('Cannot read properties of undefined') &&
            !error.message.includes('Cannot read properties of null')) {
            alert('Failed to display row details. Please try again.');
        }
    }
}

const style = document.createElement('style');
style.textContent = `
    /* Global styles */
    body {
        background-color: #f8f9fa;
    }

    /* Header styles */
    #top-controls {
        max-width: 1300px;  /* matches Bootstrap's .container width */
        box-shadow: 0 2px 4px rgba(0,0,0,0.08);
        background-color: #435f7b;
        margin: 0 auto; 
        color: white; 
        border-top-left-radius: 10px;    /* Added for top-left corner */
        border-top-right-radius: 10px;   /* Added for top-right corner */
        border-bottom-left-radius: 10px;    /* Added for bottom-left corner */
        border-bottom-right-radius: 10px;   /* Added for bottom-right corner */
    }

    #top-controls > div {
        max-width: 1300px;  /* matches Bootstrap's .container width */
        margin: 0 auto;
        padding: 0 12px;
    }

    #top-controls .btn {
        padding: 8px 12px;
        border-radius: 6px;
        font-weight: 500;
    }

    #select-data-folder-btn {
        background-color: #435f7b !important;  /* Same as header background */
        border: none;
        color: white !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        transition: all 0.2s ease;
    }

    #select-data-folder-btn:hover {
        background-color: #7393B3 !important;  /* Same as card header */
        transform: translateY(-1px);
    }
    #send-data-btn {
        background-color: #fb5743 !important;
        border-color: white !important;
        color: white !important;
        transition: all 0.2s ease;
    }

    #send-data-btn:hover {
        background-color: #e13e2a !important;
        transform: translateY(-1px);
    }

    /* Welcome screen styles */
    .welcome-title {
        color: #2d3748;
        font-weight: 600;
    }

    /* Card styles */
    .card {
        border: none;
        border-radius: 10px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .card:hover {
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .card-header {
        background-color: #7393B3;
        border-bottom: 1px solid rgba(0,0,0,0.08);
        padding: 10px !important; 
        color: white;
        border-radius: 10px;
    }

    .card-title {
        color: white;
        font-weight: 600;
    }

    /* Button styles */
    .btn {
        background-color: #4c8c8c; !important;
        border-radius: 6px;
        font-weight: 500;
        transition: all 0.2s ease;
    }

    .btn-primary {
        background-color: #4c8c8c; !important;
        border: none;
    }

    .btn-primary:hover {
        background-color: #315a5a;
        transform: translateY(-1px);
    }

    .btn-success {
        background-color: #437b43;
        border: none;
    }

    .btn-success:hover {
        background-color: #1f391f;
        transform: translateY(-1px);
    }
        
    /* New urgent button style */
    .btn-warning {
        background-color: #660000;  
        border: none;
        color: white;
        font-size: 1.1rem;  /* Increased font size */
        font-weight: 600;  
    }

    .btn-warning:hover {
        background-color: #4c0000;  /* Darker orange on hover */
        transform: translateY(-1px);
        color: white;
    }


    /* Updated trajectory view buttons */
    .btn-group .btn-outline-primary {
        background-color: #4c8c8c;
        color: white;
        border-color: #4c8c8c;
        transition: all 0.2s ease;
    }

    .btn-group .btn-outline-primary:hover {
        background-color: #315a5a;
        border-color: #315a5a;
        color: white;
    }

    .btn-group .btn-outline-primary.active {
        background-color: #162828;
        border-color: #162828;
        color: white;
        box-shadow: inset 0 3px 5px rgba(0, 0, 0, 0.125);
    }

    .btn-group .btn-outline-primary:focus {
        box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
    }
    /* User selection styles */
    .user-btn {
        padding: 8px 20px;
        margin: 0.5rem;
        border-radius: 6px;
        transition: all 0.2s ease;
    }

    .user-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    /* Form controls */
    .form-control {
        border-radius: 6px;
        border: 1px solid #e2e8f0;
        padding: 0.75rem;
        background-color: #f8f9fa;  /* light grey */
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .form-control:focus {
        border-color: #0056b3;
        box-shadow: 0 0 0 2px rgba(0,86,179,0.1);
    }

    /* Toast notification */
    .toast-notification {
        background-color: #437b43;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

        /* Table styles */
    .table-container {
        background-color: white;
        border-radius: 10px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        margin-bottom: 1.5rem;
        position: relative;  
    }

    .table-header {
        background-color: #7393B3;
        color: white;
        padding: 1rem 1.25rem;
        border-top-left-radius: 10px;
        border-top-right-radius: 10px;
        border-bottom: 1px solid rgba(0,0,0,0.08);
    }

    .table-header h5 {
        margin-bottom: 0;
        font-weight: 600;
    }

    .table {
        margin-bottom: 0;
    }

    .table thead {
        position: sticky;
        top: 0;
        background: white;
        z-index: 10;
    }

    .table thead th {
        background-color: #f8f9fa;
        border-bottom: 2px solid #dee2e6;
        font-weight: 600;
        position: sticky;
        top: 0;
        z-index: 10;
    }

    .table-success {
        background-color: rgba(25, 135, 84, 0.15) !important;
    }

    .table-danger {
        background-color: rgba(255, 0, 0, 0.1) !important;
    }

    /* Add hover states for better UX */
    .table-success:hover {
        background-color: rgba(25, 135, 84, 0.25) !important;
    }

    .table-danger:hover {
        background-color: rgba(255, 0, 0, 0.15) !important;
    }

    .truncated-text {
        position: relative;
        display: flex;
        align-items: flex-start;
        max-width: 300px;
    }

    .truncated-text .content {
        flex: 1;
    }

    .truncated-text .full-text {
        white-space: pre-wrap;
        word-break: break-word;
    }

    .truncated-text .expand-btn {
        flex-shrink: 0;
        color: #0d6efd;
        padding: 0;
        margin-left: 4px;
    }

    .truncated-text .expand-btn i {
        transition: transform 0.2s ease;
    }

    .truncated-text .expand-btn:hover {
        color: #0a58ca;
        text-decoration: none;
    
    /* Emoji styles */
    .emoji-stat {
        font-size: 1.1em;
        margin-right: 0.5rem;
    }

    /* Image container */
    .image-preview {
        border-radius: 8px;
        overflow: hidden;
    }

    .formatted-content {
        white-space: normal;
    }

    .formatted-content h1,
    .formatted-content h2 {
        margin: 0.5em 0;
        font-size: 1.2em;
        font-weight: bold;
    }

    .formatted-content ul {
        margin: 0.5em 0;
        padding-left: 20px;
    }

    .formatted-content p {
        margin: 0.5em 0;
    }
    
    .footer {
        text-align: center;
        padding: 20px;
        color: #6c757d;
        margin-top: 3rem;
        border-top: 1px solid #dee2e6;
        background-color: white;
    }
    /* Status badges */
    .status-badge {
        display: inline-block;
        padding: 0.25rem 0.75rem;
        border-radius: 999px;
        font-size: 0.875rem;
        font-weight: 500;
        background-color: #e2e8f0;
    }

    /* Scrollbar styling */
    ::-webkit-scrollbar {
        width: 8px;
    }

    ::-webkit-scrollbar-track {
        background: #f1f1f1;
    }

    ::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
        background: #666;
    }
`;
document.head.appendChild(style);

const footer = document.createElement('footer');
footer.className = 'footer';
footer.innerHTML = `
    <div class="container text-center">
        <p class="mb-0 text-secondary">© CMBSL, 2024</p>
    </div>
`;

document.body.appendChild(footer);

document.addEventListener('DOMContentLoaded', loadWelcomeScreen);

window.addEventListener('hashchange', restoreStateFromURL);

window.updateSendButton = updateSendButton;

// Move savePostNotes outside of displayRowDetails
window.savePostNotes = async function(author, rowNumber) {
    try {
        console.log('Starting savePostNotes:', { author, rowNumber });
        const newNotes = document.getElementById('postNotes').innerHTML;
        const hasNotes = newNotes.replace(/<[^>]*>/g, '').trim() !== '';
        
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
            // Update notes in trajectory file
            parsedData.data[rowNumber - 1][`Notes_${selectedUser}`] = newNotes;
            const summaryColumn = `Summary_${selectedUser}`;
            const currentSummary = parsedData.data[rowNumber - 1][summaryColumn] || '';
            
            // Update trajectory file summary based on whether there are notes
            if (hasNotes) {
                if (!currentSummary.includes('Notes saved')) {
                    parsedData.data[rowNumber - 1][summaryColumn] = 
                        currentSummary ? `${currentSummary}, Notes saved` : 'Notes saved';
                }
            } else {
                // Remove 'Notes saved' from summary if notes are empty
                parsedData.data[rowNumber - 1][summaryColumn] = 
                    currentSummary.replace(/, Notes saved|Notes saved,|Notes saved/, '').trim();
            }
    
            // Update users.csv
            try {
                console.log('Getting users.csv file');
                const usersCSVHandle = await dataFolderHandle.getFileHandle('users.csv');
                const usersFile = await usersCSVHandle.getFile();
                const usersContent = await usersFile.text();
                const usersParsedData = Papa.parse(usersContent, { header: true });
                
                const authorIndex = usersParsedData.data.findIndex(row => row.Author === author);
                console.log('Author index in users.csv:', authorIndex);
                
                if (authorIndex !== -1) {
                    const userSummaryColumn = `Summary_${selectedUser}`;
                    const userCurrentSummary = usersParsedData.data[authorIndex][userSummaryColumn] || '';
                    
                    if (hasNotes) {
                        if (!userCurrentSummary.includes('Notes saved')) {
                            console.log('Updating users.csv summary');
                            usersParsedData.data[authorIndex][userSummaryColumn] = 
                                userCurrentSummary ? `${userCurrentSummary}, Notes saved` : 'Notes saved';
                        }
                    } else {
                        // Remove 'Notes saved' from user summary if notes are empty
                        usersParsedData.data[authorIndex][userSummaryColumn] = 
                            userCurrentSummary.replace(/, Notes saved|Notes saved,|Notes saved/, '').trim();
                    }
                    
                    const usersCsvContent = Papa.unparse(usersParsedData.data);
                    const usersWritable = await usersCSVHandle.createWritable();
                    await usersWritable.write(usersCsvContent);
                    await usersWritable.close();
                    console.log('Successfully updated users.csv');
                }
            } catch (error) {
                console.error('Error updating users.csv:', error);
            }
            
            // Write back to trajectory file
            const csvContent = Papa.unparse(parsedData.data);
            const writable = await trajectoryFileHandle.createWritable();
            await writable.write(csvContent);
            await writable.close();
            showToast('Notes saved successfully!');

            // Refresh the display
            await displayRowDetails(author, rowNumber, parsedData.data[rowNumber - 1], parsedData.data);
        }
    } catch (error) {
        console.error('Error saving post notes:', error);
        alert('Failed to save notes. Please try again.');
    }
};

// Add the saveConspiracyAnalysis function
window.saveConspiracyAnalysis = async function(author, rowNumber) {
    try {
        console.log('Starting saveConspiracyAnalysis:', { author, rowNumber });
        
        // Get form values
        const topics = Array.from(document.getElementById('topics').selectedOptions).map(option => option.value);
        const specificTopic = document.getElementById('specificTopic').value;
        const beliefDegree = document.getElementById('beliefDegree').value;
        const beliefComments = document.getElementById('beliefComments').value;
        const commentReactions = document.getElementById('commentReactions').value;
        const reactionComments = document.getElementById('reactionComments').value;
        const sourcesUsed = Array.from(document.getElementById('sourcesUsed').selectedOptions).map(option => option.value);
        const sourceComments = document.getElementById('sourceComments').value;

        // Get the trajectory file
        const dataFolderHandle = await userFolderHandle.getDirectoryHandle('Data');
        const trajectoriesFolderHandle = await dataFolderHandle.getDirectoryHandle('TrajectoriesToAnalyse');
        const trajectoryFileHandle = await trajectoriesFolderHandle.getFileHandle(`${author}.csv`);
        
        // Read current content
        const file = await trajectoryFileHandle.getFile();
        const content = await file.text();
        const parsedData = Papa.parse(content, { header: true });
        
        // Update data for the specific row
        if (parsedData.data[rowNumber - 1]) {
            // Update conspiracy analysis fields
            parsedData.data[rowNumber - 1][`Topics_${selectedUser}`] = topics.join('; ');
            parsedData.data[rowNumber - 1][`SpecificTopic_${selectedUser}`] = specificTopic;
            parsedData.data[rowNumber - 1][`BeliefDegree_${selectedUser}`] = beliefDegree;
            parsedData.data[rowNumber - 1][`BeliefComments_${selectedUser}`] = beliefComments;
            parsedData.data[rowNumber - 1][`CommentReactions_${selectedUser}`] = commentReactions;
            parsedData.data[rowNumber - 1][`ReactionComments_${selectedUser}`] = reactionComments;
            parsedData.data[rowNumber - 1][`SourcesUsed_${selectedUser}`] = sourcesUsed.join('; ');
            parsedData.data[rowNumber - 1][`SourceComments_${selectedUser}`] = sourceComments;

            // Write back to trajectory file
            const csvContent = Papa.unparse(parsedData.data);
            const writable = await trajectoryFileHandle.createWritable();
            await writable.write(csvContent);
            await writable.close();
            
            showToast('Conspiracy analysis saved successfully!');

            // Refresh the display
            await displayRowDetails(author, rowNumber, parsedData.data[rowNumber - 1], parsedData.data);
        }
    } catch (error) {
        console.error('Error saving conspiracy analysis:', error);
        alert('Failed to save conspiracy analysis. Please try again.');
    }
};

// Add the showGuidelines function
window.showGuidelines = async function() {
    try {
        const response = await fetch('guidelines.md');
        const text = await response.text();
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'guidelinesModal';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Conspiracy Analysis Guidelines</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div id="guidelinesContent" class="markdown-body"></div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();

        // Convert markdown to HTML
        const content = document.getElementById('guidelinesContent');
        content.innerHTML = marked.parse(text);

        // Cleanup
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
    } catch (error) {
        console.error('Error loading guidelines:', error);
        alert('Failed to load guidelines. Please try again.');
    }
};

// Replace the showGuidelines function with openGuidelines
window.openGuidelines = function() {
    const helpWindow = window.open('', 'Guidelines', 'width=800,height=600');
    
    helpWindow.document.write(`
        <html lang="en">
        <head>
            <title>Guidelines - Conspiracy Trajectory Analysis App</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css/github-markdown.css">
            <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
            <style>
                .markdown-body {
                    box-sizing: border-box;
                    min-width: 200px;
                    max-width: 980px;
                    margin: 0 auto;
                    padding: 45px;
                }
                @media (max-width: 767px) {
                    .markdown-body {
                        padding: 15px;
                    }
                }
                .nav-tabs {
                    margin-bottom: 20px;
                }
                .tab-content {
                    display: none;
                }
                .tab-content.active {
                    display: block;
                }
            </style>
        </head>
        <body class="markdown-body">
            <div id="content">
                <ul class="nav nav-tabs" id="guidelinesTabs" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" id="conspiracy-tab" data-bs-toggle="tab" data-bs-target="#conspiracy" type="button" role="tab">Conspiracy Analysis</button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="trajectory-tab" data-bs-toggle="tab" data-bs-target="#trajectory" type="button" role="tab">Trajectory Graphs</button>
                    </li>
                </ul>
                <div class="tab-content" id="guidelinesTabContent">
                    <div class="tab-pane fade show active" id="conspiracy" role="tabpanel"></div>
                    <div class="tab-pane fade" id="trajectory" role="tabpanel"></div>
                </div>
            </div>
            <script>
                document.title = "Guidelines - Conspiracy Trajectory Analysis App";
                fetch('guidelines.md')
                    .then(response => response.text())
                    .then(text => {
                        document.getElementById('conspiracy').innerHTML = marked.parse(text);
                    })
                    .catch(error => {
                        document.getElementById('conspiracy').innerHTML = 'Error loading conspiracy guidelines: ' + error;
                    });
                
                fetch('trajectory_guidelines.md')
                    .then(response => response.text())
                    .then(text => {
                        document.getElementById('trajectory').innerHTML = marked.parse(text);
                    })
                    .catch(error => {
                        document.getElementById('trajectory').innerHTML = 'Error loading trajectory guidelines: ' + error;
                    });
            </script>
        </body>
        </html>
    `);
};

// Add this function to reload the users table
window.reloadUsersTable = function() {
    displayUsersTable(Object.keys(usersCSVData[0]), usersCSVData);
};
