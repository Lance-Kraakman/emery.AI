/**
 * Shared utilities for workspace sync operations
 */

import { readdir, stat } from 'fs/promises';
import { join, relative } from 'path';

/**
 * Recursively walk a directory and return relative paths of all files.
 * Excludes common non-essential files like .git, node_modules, etc.
 */
export async function walkDirectory(
  dir: string,
  baseDir?: string
): Promise<string[]> {
  const base = baseDir ?? dir;
  const files: string[] = [];

  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    // Skip common non-essential directories
    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) {
        continue;
      }
      const subFiles = await walkDirectory(fullPath, base);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      const relativePath = relative(base, fullPath);
      files.push(relativePath);
    }
  }

  return files;
}

/**
 * Directories to skip during sync
 */
function shouldSkipDirectory(name: string): boolean {
  const skipDirs = [
    '.git',
    'node_modules',
    '__pycache__',
    '.pytest_cache',
    '.mypy_cache',
    '.ruff_cache',
    'venv',
    '.venv',
    'env',
    '.env',
    '.idea',
    '.vscode',
    '.DS_Store',
    'dist',
    'build',
    '.next',
    'coverage',
  ];
  return skipDirs.includes(name);
}

/**
 * Check if a file should be skipped during sync
 */
export function shouldSkipFile(name: string): boolean {
  const skipPatterns = [
    '.DS_Store',
    'Thumbs.db',
    '.gitkeep',
  ];
  return skipPatterns.includes(name) || name.endsWith('.pyc');
}
