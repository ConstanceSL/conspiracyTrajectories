// Utility function to save CSV data back to the file
async function saveCSVFile(fileName, data) {
    if (!folderHandle) {
        alert('No folder selected. Please select a folder before saving.');
        return;
    }

    try {
        const fileHandle = await folderHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        const csvText = Papa.unparse(data);
        await writable.write(csvText);
        await writable.close();
        alert(`${fileName} saved successfully.`);
    } catch (error) {
        console.error(`Error saving ${fileName}:`, error);
        alert(`Failed to save ${fileName}. Please try again.`);
    }
}

}

// Utility function to load a CSV file using the File System Access API or fallback
async function loadCSVFile(fileName) {
    try {
        if (folderHandle) {
            // Use the File System Access API if folderHandle is available
            const fileHandle = await folderHandle.getFileHandle(fileName);
            const file = await fileHandle.getFile();
            const text = await file.text();
            return Papa.parse(text, { header: true }).data;
        } else {
            alert('Folder not selected. Please select a data folder first.');
            return [];
        }
    } catch (error) {
        console.error(`Error loading ${fileName}:`, error);
        alert(`Failed to load ${fileName}. Please check the folder contents.`);
        return [];
    }
}
