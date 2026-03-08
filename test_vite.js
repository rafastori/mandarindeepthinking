const fetch = require('node-fetch'); // might not be needed in Node 18+

async function run() {
    try {
        const url = 'http://localhost:3000/api/export-pdf.py';
        const res = await globalThis.fetch(url, {
            method: 'POST',
            body: JSON.stringify({ type: 'stats', data: {} })
        });
        console.log("Status:", res.status);
        console.log("Headers:", Object.fromEntries(res.headers.entries()));
        const text = await res.text();
        console.log("Response text start:", text.substring(0, 100));
    } catch (e) {
        console.log("Error:", e);
    }
}
run();
