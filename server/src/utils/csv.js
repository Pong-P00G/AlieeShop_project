// Minimal CSV serialization for admin export endpoints.
//
// Kept dependency-free on purpose: exports are small (a dashboard listing),
// so a streaming writer would be overkill. Values are quoted only when they
// contain a comma, quote or newline, and embedded quotes are doubled — which
// is what every spreadsheet expects.

export const csvEscape = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

/**
 * Build a CSV document from rows and a column map.
 *
 * @param {Array<object>} rows
 * @param {Array<{ label: string, value: string | ((row: object) => unknown) }>} columns
 *   `value` is either a property name or a resolver function.
 * @returns {string} CSV text with CRLF line endings (Excel-friendly).
 */
export const toCsv = (rows, columns) => {
    const header = columns.map((c) => csvEscape(c.label)).join(',');
    const body = rows.map((row) =>
        columns
            .map((c) => csvEscape(typeof c.value === 'function' ? c.value(row) : row[c.value]))
            .join(',')
    );
    return [header, ...body].join('\r\n');
};
