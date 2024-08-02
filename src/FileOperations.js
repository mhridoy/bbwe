import JSZip from 'jszip';
import FileSaver from 'file-saver';

export const downloadCode = (files) => {
    const zip = new JSZip();

    // Add each file to the zip
    Object.entries(files).forEach(([filename, content]) => {
        zip.file(filename, content);
    });

    // Generate the zip file
    zip.generateAsync({ type: "blob" })
        .then((content) => {
            // Save the zip file
            FileSaver.saveAs(content, "project.zip");
        });
};

export const uploadCode = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const zip = new JSZip();
            zip.loadAsync(event.target.result)
                .then((zip) => {
                    const files = {};
                    const promises = [];

                    zip.forEach((relativePath, zipEntry) => {
                        const promise = zipEntry.async("string").then((content) => {
                            files[relativePath] = content;
                        });
                        promises.push(promise);
                    });

                    Promise.all(promises).then(() => resolve(files));
                })
                .catch(reject);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};