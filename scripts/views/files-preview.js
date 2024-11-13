// Globals
let userFolderHandle = null;
let username = '';
let filesList = [];
let currentFileHandle = null;
let currentFileData = [];

// Initialize Files Preview Page
async function loadFilesPreview() {
    const urlParams = new URLSearchParams(window.location.search);
    username = urlParams.get('username');
    document.getElementById('username-display').textContent = username;

    try {
        // Access the user's folder
        const folderHandle = await window.showDirectoryPicker();
        const usersFolderHandle = await folderHandle.getDirectoryHandle('Users');
        userFolderHandle = await usersFolderHandle.getDirectoryHandle(username);

        // Load files list
        await loadFilesList();
    } catch (error) {
        console.error('Error accessing user folder:', error);
        alert('Failed to access the user folder. Please try again.');
    }
}

// Load List of CSV Files
async function loadFilesList() {
    try {
        const dataFolderHandle = await userFolderHandle.getDirectoryHandle('Data');
        const trajectoriesFolderHandle = await dataFolderHandle.getDirectoryHandle('TrajectoriesToAnalyse', { create: false });
        filesList = [];

        // Collect CSV files from 'Data' and 'TrajectoriesToAnalyse'
        for await (const entry of dataFolderHandle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.csv')) {
                filesList.push(entry.name);
            }
        }
        for await (const entry of trajectoriesFolderHandle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.csv')) {
                filesList.push(`TrajectoriesToAnalyse/${entry.name}`);
            }
        }

        displayFilesList();
    } catch (error) {
        console.error('Error loading files list:', error);
        alert('Failed to load files list.');
    }
}

// Display List of Files
function displayFilesList() {
    const filesListDiv = document.getElementById('files-list');
    filesListDiv.innerHTML = '<h3>Available CSV Files:</h3><ul id="file-list"></ul>';

    const fileList = document.getElementById('file-list');
    fileList.innerHTML = filesList.map(file => `<li><button class="btn btn-link file-btn">${file}</button></li>`).join('');

    // Event listeners for file preview
    document.querySelectorAll('.file-btn').forEach(btn => {
        btn.addEventListener('click', () => previewFile(btn.textContent));
    });
}

// Preview File Content
async function previewFile(fileName) {
    try {
        const fileHandle = fileName.startsWith('TrajectoriesToAnalyse/')
            ? await userFolderHandle.getDirectoryHandle('Data').then(handle => handle.getDirectoryHandle('TrajectoriesToAnalyse')).then(handle => handle.getFileHandle(fileName.split('/')[1]))
            : await userFolderHandle.getDirectoryHandle('Data').then(handle => handle.getFileHandle(fileName));

        const file = await fileHandle.getFile();
        const text = await file.text();
        const parsedData = Papa.parse(text, { header: true });

        currentFileHandle = fileHandle;
        currentFileData = parsedData.data;

        displayFilePreview(parsedData.meta.fields, parsedData.data);
    } catch (error) {
        console.error('Error previewing file:', error);
        alert('Failed to preview the file.');
    }
}

// Display File Preview
function displayFilePreview(fields, data) {
    const filePreviewDiv = document.getElementById('file-preview');
    filePreviewDiv.innerHTML = `<table id="file-table" class="table"><thead><tr>${fields.map(field => `<th>${field}</th>`).join('')}</tr></thead><tbody></tbody></table>`;

    const tableBody = document.querySelector('#file-table tbody');
    tableBody.innerHTML = data.slice(0, 10).map(row => `<tr>${fields.map(field => `<td contenteditable="${field.startsWith('Notes_')}">${row[field] || ''}</td>`).join('')}</tr>`).join('');

    document.getElementById('save-changes-btn').classList.remove('d-none');
}

// Save Changes to the File
async function saveChanges() {
    try {
        const tableBody = document.querySelector('#file-table tbody');
        const updatedData = Array.from(tableBody.rows).map(row => {
            const rowData = {};
            Array.from(row.cells).forEach((cell, index) => {
                rowData[currentFileData[0].meta.fields[index]] = cell.textContent;
            });
            return rowData;
        });

        const csvContent = Papa.unparse(updatedData);
        const writable = await currentFileHandle.createWritable();
        await writable.write(csvContent);
        await writable.close();

        alert('Changes saved successfully.');
    } catch (error) {
        console.error('Error saving changes:', error);
        alert('Failed to save changes.');
    }
}

// Event Listener for Save Button
document.getElementById('save-changes-btn').addEventListener('click', saveChanges);

// Initialize the Files Preview Page
document.addEventListener('DOMContentLoaded', loadFilesPreview);
