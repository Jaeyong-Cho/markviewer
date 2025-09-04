const fs = require('fs').promises;
const path = require('path');
const fsSync = require('fs');

/**
 * File system handler for markdown viewer
 * Provides safe file operations with path validation
 */
class FileHandler {
    constructor() {
        this.allowedExtensions = ['.md', '.markdown', '.txt'];
        this.excludedDirs = ['.git', 'node_modules', '.vscode', '.idea', '__pycache__'];
    }

    /**
     * Validate that a path is safe and within allowed boundaries
     * @param {string} filePath - Path to validate
     * @throws {Error} If path is invalid or unsafe
     */
    validatePath(filePath) {
        if (!filePath) {
            throw new Error('Path is required');
        }

        // Resolve path to prevent directory traversal
        const resolvedPath = path.resolve(filePath);
        
        // Check if path exists
        if (!fsSync.existsSync(resolvedPath)) {
            throw new Error(`Path does not exist: ${filePath}`);
        }

        return resolvedPath;
    }

    /**
     * Check if a file should be included based on extension
     * @param {string} fileName - Name of the file
     * @returns {boolean} True if file should be included
     */
    isMarkdownFile(fileName) {
        const ext = path.extname(fileName).toLowerCase();
        return this.allowedExtensions.includes(ext);
    }

    /**
     * Check if a directory should be excluded
     * @param {string} dirName - Name of the directory
     * @returns {boolean} True if directory should be excluded
     */
    shouldExcludeDirectory(dirName) {
        return this.excludedDirs.includes(dirName) || dirName.startsWith('.');
    }

    /**
     * Get directory tree structure recursively
     * @param {string} rootPath - Root directory path
     * @returns {Promise<Object>} Directory tree object
     */
    async getDirectoryTree(rootPath) {
        const validatedPath = this.validatePath(rootPath);
        
        try {
            const stats = await fs.stat(validatedPath);
            
            if (!stats.isDirectory()) {
                throw new Error('Path must be a directory');
            }

            return await this.buildDirectoryTree(validatedPath);
        } catch (error) {
            throw new Error(`Failed to read directory: ${error.message}`);
        }
    }

    /**
     * Recursively build directory tree structure
     * @param {string} dirPath - Directory path to process
     * @returns {Promise<Object>} Directory tree node
     */
    async buildDirectoryTree(dirPath) {
        const dirName = path.basename(dirPath);
        const node = {
            name: dirName,
            path: dirPath,
            type: 'directory',
            children: []
        };

        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            // Sort entries: directories first, then files
            const sortedEntries = entries.sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.localeCompare(b.name);
            });

            for (const entry of sortedEntries) {
                const entryPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    // Skip excluded directories
                    if (this.shouldExcludeDirectory(entry.name)) {
                        continue;
                    }

                    // Recursively process subdirectory
                    const childNode = await this.buildDirectoryTree(entryPath);
                    if (childNode.children.length > 0 || await this.hasMarkdownFiles(entryPath)) {
                        node.children.push(childNode);
                    }
                } else if (entry.isFile() && this.isMarkdownFile(entry.name)) {
                    // Add markdown file
                    node.children.push({
                        name: entry.name,
                        path: entryPath,
                        type: 'file'
                    });
                }
            }
        } catch (error) {
            console.warn(`Could not read directory ${dirPath}: ${error.message}`);
        }

        return node;
    }

    /**
     * Check if directory contains any markdown files (recursively)
     * @param {string} dirPath - Directory path to check
     * @returns {Promise<boolean>} True if directory contains markdown files
     */
    async hasMarkdownFiles(dirPath) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isFile() && this.isMarkdownFile(entry.name)) {
                    return true;
                }
                
                if (entry.isDirectory() && !this.shouldExcludeDirectory(entry.name)) {
                    const subDirPath = path.join(dirPath, entry.name);
                    if (await this.hasMarkdownFiles(subDirPath)) {
                        return true;
                    }
                }
            }
        } catch (error) {
            // Ignore errors when checking subdirectories
        }
        
        return false;
    }

    /**
     * Read and return file content
     * @param {string} filePath - Path to the file
     * @returns {Promise<string>} File content
     */
    async getFileContent(filePath) {
        const validatedPath = this.validatePath(filePath);
        
        try {
            const stats = await fs.stat(validatedPath);
            
            if (!stats.isFile()) {
                throw new Error('Path must be a file');
            }

            // Check file size (limit to 10MB)
            if (stats.size > 10 * 1024 * 1024) {
                throw new Error('File too large (maximum 10MB)');
            }

            const content = await fs.readFile(validatedPath, 'utf-8');
            return content;
        } catch (error) {
            throw new Error(`Failed to read file: ${error.message}`);
        }
    }

    /**
     * Get all markdown files in a directory recursively
     * @param {string} rootPath - Root directory path
     * @returns {Promise<Array>} Array of file paths
     */
    async getAllMarkdownFiles(rootPath) {
        const validatedPath = this.validatePath(rootPath);
        const files = [];

        await this.collectMarkdownFiles(validatedPath, files);
        return files;
    }

    /**
     * Recursively collect markdown file paths
     * @param {string} dirPath - Directory path to process
     * @param {Array} fileList - Array to collect file paths
     */
    async collectMarkdownFiles(dirPath, fileList) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const entryPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    if (!this.shouldExcludeDirectory(entry.name)) {
                        await this.collectMarkdownFiles(entryPath, fileList);
                    }
                } else if (entry.isFile() && this.isMarkdownFile(entry.name)) {
                    fileList.push(entryPath);
                }
            }
        } catch (error) {
            console.warn(`Could not read directory ${dirPath}: ${error.message}`);
        }
    }
}

module.exports = new FileHandler();
