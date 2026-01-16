import * as XLSX from 'xlsx';

/**
 * Export data to XLSX file and trigger download
 * @param {Array} data - Array of objects to export
 * @param {Array} headers - Array of column headers {key, label}
 * @param {string} filename - Filename without extension
 * @param {string} sheetName - Name of the sheet
 */
export function exportToXLSX(data, headers, filename, sheetName = 'Sheet1') {
    // Create worksheet data with headers
    const headerRow = headers.map(h => h.label);
    const dataRows = data.map(row => headers.map(h => row[h.key] ?? ''));

    const wsData = [headerRow, ...dataRows];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    const colWidths = headers.map(h => ({ wch: Math.max(h.label.length, 15) }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Generate and download
    XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export simple 2D array to XLSX
 * @param {Array} rows - 2D array including headers
 * @param {string} filename - Filename without extension
 * @param {string} sheetName - Name of the sheet
 */
export function exportArrayToXLSX(rows, filename, sheetName = 'Sheet1') {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Auto-fit columns
    if (rows.length > 0) {
        const colWidths = rows[0].map((_, colIndex) => {
            const maxWidth = Math.max(...rows.map(row =>
                String(row[colIndex] || '').length
            ));
            return { wch: Math.max(maxWidth, 10) };
        });
        ws['!cols'] = colWidths;
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Download template XLSX with headers and sample data
 * @param {Array} headers - Array of header strings
 * @param {Array} sampleRows - Array of sample data rows
 * @param {string} filename - Filename without extension
 * @param {Array} infoRows - Optional info rows at the top (will be styled differently)
 */
export function downloadTemplate(headers, sampleRows, filename, infoRows = []) {
    const wb = XLSX.utils.book_new();

    // Build worksheet data
    const wsData = [...infoRows, headers, ...sampleRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    const colWidths = headers.map(h => ({ wch: Math.max(String(h).length, 15) }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Import data from XLSX or CSV file
 * @param {File} file - File object from input
 * @param {Function} callback - Callback function receiving parsed data {headers, rows}
 */
export function importFromFile(file, callback) {
    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            // Get first sheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Convert to array of arrays
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (rows.length < 2) {
                callback({ error: 'File kosong atau format salah', headers: [], rows: [] });
                return;
            }

            // Filter out comment/info rows (starting with #)
            const dataRows = rows.filter(row =>
                row.length > 0 && !String(row[0]).startsWith('#')
            );

            const headers = dataRows[0].map(h => String(h).trim().toLowerCase());
            const bodyRows = dataRows.slice(1).filter(row =>
                row.some(cell => cell !== null && cell !== undefined && cell !== '')
            );

            callback({
                headers,
                rows: bodyRows.map(row => {
                    const obj = {};
                    headers.forEach((h, i) => {
                        obj[h] = row[i] ?? '';
                    });
                    return obj;
                }),
                error: null
            });
        } catch (error) {
            console.error('Import error:', error);
            callback({ error: 'Gagal membaca file. Pastikan format file benar.', headers: [], rows: [] });
        }
    };

    reader.readAsArrayBuffer(file);
}

/**
 * Check if file is valid Excel or CSV
 * @param {string} filename 
 * @returns {boolean}
 */
export function isValidSpreadsheetFile(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return ['xlsx', 'xls', 'csv'].includes(ext);
}
