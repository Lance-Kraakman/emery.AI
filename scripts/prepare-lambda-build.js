#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Skip gracefully if infra directory doesn't exist (e.g., during Docker build)
if (!fs.existsSync(path.join(__dirname, '..', 'infra'))) {
  console.log('ℹ️  Skipping Lambda build preparation (infra directory not found)');
  process.exit(0);
}

const PROJECT_ROOT = path.join(__dirname, '..');
const BUILD_DIR = path.join(PROJECT_ROOT, 'infra/lambda/migration-runner/build');

function copyRecursively(src, dest) {
  const stat = fs.statSync(src);
  
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const files = fs.readdirSync(src);
    for (const file of files) {
      copyRecursively(
        path.join(src, file), 
        path.join(dest, file)
      );
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('🔧 Preparing Lambda build directory...');

// Clean and recreate build directory
if (fs.existsSync(BUILD_DIR)) {
  fs.rmSync(BUILD_DIR, { recursive: true });
}
fs.mkdirSync(BUILD_DIR, { recursive: true });

// Copy essential files
const filesToCopy = [
  { src: 'drizzle.config.ts', dest: 'drizzle.config.ts' },
  { src: 'lib/db', dest: 'lib/db' },
  { src: 'drizzle', dest: 'drizzle' },
  { src: 'infra/lambda/migration-runner/package.json', dest: 'package.json' },
  { src: 'infra/lambda/migration-runner/index.mjs', dest: 'index.mjs' },
  { src: 'infra/lambda/migration-runner/Dockerfile', dest: 'Dockerfile' }
];

for (const { src, dest } of filesToCopy) {
  const srcPath = path.join(PROJECT_ROOT, src);
  const destPath = path.join(BUILD_DIR, dest);
  
  if (fs.existsSync(srcPath)) {
    console.log(`📄 Copying ${src} → ${dest}`);
    if (fs.statSync(srcPath).isDirectory()) {
      copyRecursively(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  } else {
    console.warn(`⚠️  Source file not found: ${src}`);
  }
}

console.log('✅ Lambda build directory prepared successfully');