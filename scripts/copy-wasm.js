const fs = require('fs');
const path = require('path');

const wasmPkgDir = path.join(__dirname, '../wasm/pkg');
const destDir = path.join(__dirname, '../src/wasm-module');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const essentialFiles = ['contexter_wasm.js', 'contexter_wasm_bg.wasm'];

let copiedCount = 0;
for (const file of essentialFiles) {
  const srcPath = path.join(wasmPkgDir, file);
  const destPath = path.join(destDir, file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${file} to ${destDir}`);
    copiedCount++;
  } else {
    console.warn(`Warning: Source file not found: ${srcPath}`);
  }
}

if (copiedCount === essentialFiles.length) {
  console.log('✅ WASM files copy completed successfully.');
} else {
  console.error('❌ WASM files copy failed. Please run the wasm-pack build command first.');
  process.exit(1);
}
