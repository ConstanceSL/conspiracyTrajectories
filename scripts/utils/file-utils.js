// Utility function to load a CSV file using the File System Access API
async function loadCSVFile(fileName) {
    if (!folderHandle) {
        alert('No folder selected. Please select a data folder first.');
        return [];
    }

    try {
        const fileHandle = await folderHandle.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        const text = await file.text();
        return Papa.parse(text, { header: true }).data;
    } catch (error) {
        console.error(`Error loading ${fileName}:`, error);
        alert(`Failed to load ${fileName}. Please check the folder contents.`);
        return [];
    }
}

// Utility function to save CSV data to a file
async function saveCSVFile(fileName, data) {
    if (!folderHandle) {
        alert('No folder selected. Please select a folder before saving.');
        return;
    }

    const csvText = Papa.unparse(data);

    try {
        // Check if folderHandle is a real DirectoryHandle (supported in Chrome/Edge)
        if (typeof folderHandle.getFileHandle === 'function') {
            const fileHandle = await folderHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(csvText);
            await writable.close();
            alert(`${fileName} saved successfully.`);
        } else {
            // Fallback for browsers without File System Access API (e.g., Firefox)
            const blob = new Blob([csvText], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);

            // Create a download link for the file
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            alert(`${fileName} downloaded successfully.`);
        }
    } catch (error) {
        console.error(`Error saving ${fileName}:`, error);
        alert(`Failed to save ${fileName}. Please try again.`);
    }
}
