const fs = require('fs');
const path = require('path');

function deobfuscate(text) {
    const raw = atob(text.trim());
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
        bytes[i] = raw.charCodeAt(i) ^ 0x2A;
    }
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
}

try {
    const filepath = path.join(__dirname, '..', 'data', 'commentary', 'jingdu', '1.json');
    const content = fs.readFileSync(filepath, 'utf8');
    const result = deobfuscate(content);
    console.log("Successfully decoded! Keys in JSON:", Object.keys(result));
} catch (e) {
    console.error("Decode failed with error:", e);
}
