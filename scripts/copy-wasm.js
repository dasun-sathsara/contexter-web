const fs = require('fs');
const path = require('path');

// Copy WASM files from wasm/pkg to public directory
const wasmDir = path.join(__dirname, '..', 'wasm', 'pkg');
const publicDir = path.join(__dirname, '..', 'public');

const filesToCopy = ['contexter_wasm_bg.wasm', 'contexter_wasm.js', 'contexter_wasm_bg.js'];

filesToCopy.forEach((file) => {
    const srcPath = path.join(wasmDir, file);
    const destPath = path.join(publicDir, file);

    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${file} to public directory`);
    } else {
        console.warn(`Source file ${file} not found in ${wasmDir}`);
    }
});

console.log('WASM files copy completed');
