// Copy 'Data' Folder and Modify CSV Files
async function copyDataFolder(userFolderHandle, username) {
    try {
        // Access the root 'Data' folder
        const dataFolderHandle = await folderHandle.getDirectoryHandle('Data');
        // Create 'Data' folder inside the new user folder
        const userDataFolderHandle = await userFolderHandle.getDirectoryHandle('Data', { create: true });

        // Iterate through each file in the 'Data' folder
        for await (const entry of dataFolderHandle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.csv')) {
                const fileHandle = await dataFolderHandle.getFileHandle(entry.name);
                const newFileHandle = await userDataFolderHandle.getFileHandle(entry.name, { create: true });

                // Copy file content and add a 'Notes_username' column
                const file = await fileHandle.getFile();
                const text = await file.text();
                const parsedData = Papa.parse(text, { header: true });
                const notesColumn = `Notes_${username}`;

                // Add the new column to the CSV data
                if (!parsedData.meta.fields.includes(notesColumn)) {
                    parsedData.meta.fields.push(notesColumn);
                    parsedData.data.forEach(row => {
                        row[notesColumn] = ''; // Initialize new column with empty values
                    });
                }

                // Save the modified CSV content to the new user's folder
                const csvContent = Papa.unparse(parsedData.data);
                const writable = await newFileHandle.createWritable();
                await writable.write(csvContent);
                await writable.close();

                console.log(`CSV file "${entry.name}" copied and modified successfully.`);
            } else if (entry.kind === 'file') {
                // Copy non-CSV files directly
                const fileHandle = await dataFolderHandle.getFileHandle(entry.name);
                const newFileHandle = await userDataFolderHandle.getFileHandle(entry.name, { create: true });
                const file = await fileHandle.getFile();
                const writable = await newFileHandle.createWritable();
                await writable.write(await file.arrayBuffer());
                await writable.close();

                console.log(`File "${entry.name}" copied successfully.`);
            }
        }
    } catch (error) {
        console.error('Error copying Data folder:', error);
        alert('Failed to copy and modify the Data folder.');
    }
}
