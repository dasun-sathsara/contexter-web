const fs = require('fs');
const path = require('path');

const wasmPkgDir = path.join(__dirname, '../wasm/pkg');
const destDir = path.join(__dirname, '../src/wasm-module');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const requiredFiles = [
  'contexter_wasm.js',
  'contexter_wasm_bg.wasm',
];

const optionalFiles = [
  'contexter_wasm_bg.js',
  'contexter_wasm_bg.wasm.d.ts',
  'contexter_wasm.d.ts',
];

const missingRequired = [];
for (const file of [...requiredFiles, ...optionalFiles]) {
  const srcPath = path.join(wasmPkgDir, file);
  const destPath = path.join(destDir, file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${file} to ${destDir}`);
  } else if (requiredFiles.includes(file)) {
    missingRequired.push(file);
    console.warn(`Missing required file: ${srcPath}`);
  } else {
    console.warn(`Optional file not found: ${srcPath}`);
  }
}

if (missingRequired.length > 0) {
  console.error(
    `❌ WASM files copy failed. Missing required files: ${missingRequired.join(', ')}`,
  );
  process.exit(1);
}

const glueFile = 'contexter_wasm_bg.js';
const glueDestPath = path.join(destDir, glueFile);
if (!fs.existsSync(glueDestPath)) {
  const wasmEntryPath = path.join(destDir, 'contexter_wasm.js');
  if (fs.existsSync(wasmEntryPath)) {
    const entrySource = fs.readFileSync(wasmEntryPath, 'utf8');
    if (entrySource.includes(glueFile)) {
      console.error(
        '❌ WASM files copy failed. The generated entrypoint references contexter_wasm_bg.js, but it was not produced. '
          + 'Please rerun wasm-pack or pin a compatible target.',
      );
      process.exit(1);
    }
  }
}

console.log('✅ WASM files copy completed successfully.');
