// Utility function to save CSV data back to the file
async function saveCSVFile(fileName, data) {
    try {
        const fileHandle = await folderHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        const csvText = Papa.unparse(data);
        await writable.write(csvText);
        await writable.close();
        alert(`${fileName} saved successfully.`);
    } catch (error) {
        console.error(`Error saving ${fileName}:`, error);
        alert(`Failed to save ${fileName}.`);
    }
}
