const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs').promises;

/**
 * File watcher service for real-time file monitoring
 * Provides file change notifications for markdown files
 */
class FileWatcher {
    constructor() {
        this.watchers = new Map(); // Map of root paths to watcher instances
        this.subscribers = new Set(); // Set of WebSocket clients
    }

    /**
     * Add a WebSocket client to receive file change notifications
     * @param {Object} socket - Socket.IO socket instance
     */
    addSubscriber(socket) {
        this.subscribers.add(socket);
        console.log(`File watcher subscriber added. Total: ${this.subscribers.size}`);

        // Clean up when socket disconnects
        socket.on('disconnect', () => {
            this.subscribers.delete(socket);
            console.log(`File watcher subscriber removed. Total: ${this.subscribers.size}`);
        });
    }

    /**
     * Start watching a directory for file changes
     * @param {string} rootPath - Root directory path to watch
     */
    startWatching(rootPath) {
        // Normalize the root path to handle Unicode directory names
        const normalizedRootPath = this.normalizeFilePath(rootPath);
        
        if (this.watchers.has(normalizedRootPath)) {
            console.log(`Already watching directory: ${normalizedRootPath}`);
            return;
        }

        console.log(`Starting file watcher for: ${normalizedRootPath}`);
        console.log(`[DEBUG] Original path: ${rootPath}, Normalized: ${normalizedRootPath}`);

        const watcher = chokidar.watch(normalizedRootPath, {
            ignored: (path, stats) => {
                const normalizedPath = this.normalizeFilePath(path);
                
                // Ignore git directories
                if (normalizedPath.includes('/.git/') || normalizedPath.endsWith('/.git')) return true;
                
                // Ignore node_modules
                if (normalizedPath.includes('/node_modules/') || normalizedPath.endsWith('/node_modules')) return true;
                
                // Ignore system files
                if (normalizedPath.includes('/.DS_Store') || normalizedPath.includes('/Thumbs.db')) return true;
                
                // Ignore temporary files
                if (normalizedPath.endsWith('.tmp') || normalizedPath.endsWith('.temp')) return true;
                
                // Ignore hidden files/directories (but allow markdown files)
                const basename = path.basename(normalizedPath);
                if (basename.startsWith('.')) {
                    const ext = path.extname(normalizedPath).toLowerCase();
                    const isMarkdown = ['.md', '.markdown', '.mdown', '.mkd', '.mkdn'].includes(ext);
                    return !isMarkdown; // Don't ignore markdown files even if they start with dot
                }
                
                return false; // Don't ignore anything else
            },
            persistent: true,
            ignoreInitial: true,
            followSymlinks: false,
            depth: undefined, // Watch all subdirectories
            awaitWriteFinish: {
                stabilityThreshold: 100,
                pollInterval: 50
            },
            // Ensure proper UTF-8 handling for non-ASCII filenames and directories
            usePolling: false,
            atomic: true,
            // Disable globbing to better handle Unicode paths
            disableGlobbing: true,
            // Enable case sensitivity for better Unicode handling
            alwaysStat: true,
            // Improve Unicode path handling
            encoding: 'utf8'
        });

        // File added
        watcher.on('add', (filePath) => {
            const normalizedPath = this.normalizeFilePath(filePath);
            console.log(`[DEBUG] File added - Original: ${filePath}, Normalized: ${normalizedPath}`);
            if (this.isMarkdownFile(normalizedPath)) {
                console.log(`File added: ${normalizedPath}`);
                this.notifySubscribers('fileAdded', normalizedPath);
            } else {
                console.log(`[DEBUG] File ignored (not markdown): ${normalizedPath}`);
            }
        });

        // File changed
        watcher.on('change', (filePath) => {
            const normalizedPath = this.normalizeFilePath(filePath);
            console.log(`[DEBUG] File changed - Original: ${filePath}, Normalized: ${normalizedPath}`);
            if (this.isMarkdownFile(normalizedPath)) {
                console.log(`File changed: ${normalizedPath}`);
                this.notifySubscribers('fileChanged', normalizedPath);
            } else {
                console.log(`[DEBUG] File change ignored (not markdown): ${normalizedPath}`);
            }
        });

        // File removed
        watcher.on('unlink', (filePath) => {
            const normalizedPath = this.normalizeFilePath(filePath);
            console.log(`[DEBUG] File removed - Original: ${filePath}, Normalized: ${normalizedPath}`);
            if (this.isMarkdownFile(normalizedPath)) {
                console.log(`File removed: ${normalizedPath}`);
                this.notifySubscribers('fileRemoved', normalizedPath);
            } else {
                console.log(`[DEBUG] File removal ignored (not markdown): ${normalizedPath}`);
            }
        });

        // Directory added
        watcher.on('addDir', (dirPath) => {
            const normalizedPath = this.normalizeFilePath(dirPath);
            console.log(`[DEBUG] Directory added - Original: ${dirPath}, Normalized: ${normalizedPath}`);
            console.log(`Directory added: ${normalizedPath}`);
            this.notifySubscribers('directoryAdded', normalizedPath);
        });

        // Directory removed
        watcher.on('unlinkDir', (dirPath) => {
            const normalizedPath = this.normalizeFilePath(dirPath);
            console.log(`[DEBUG] Directory removed - Original: ${dirPath}, Normalized: ${normalizedPath}`);
            console.log(`Directory removed: ${normalizedPath}`);
            this.notifySubscribers('directoryRemoved', normalizedPath);
        });

        // Error handling
        watcher.on('error', (error) => {
            console.error(`File watcher error: ${error}`);
            this.notifySubscribers('watcherError', { error: error.message });
        });

        // Ready event
        watcher.on('ready', () => {
            console.log(`File watcher ready for: ${normalizedRootPath}`);
            this.notifySubscribers('watcherReady', normalizedRootPath);
        });

        this.watchers.set(normalizedRootPath, watcher);
    }

    /**
     * Stop watching a directory
     * @param {string} rootPath - Root directory path to stop watching
     */
    async stopWatching(rootPath) {
        // Normalize the path to match the key used in startWatching
        const normalizedRootPath = this.normalizeFilePath(rootPath);
        
        const watcher = this.watchers.get(normalizedRootPath);
        if (watcher) {
            console.log(`Stopping file watcher for: ${normalizedRootPath}`);
            await watcher.close();
            this.watchers.delete(normalizedRootPath);
            this.notifySubscribers('watcherStopped', normalizedRootPath);
        }
    }

    /**
     * Stop all watchers
     */
    async stopAllWatchers() {
        console.log('Stopping all file watchers');
        const promises = Array.from(this.watchers.keys()).map(rootPath => 
            this.stopWatching(rootPath)
        );
        await Promise.all(promises);
    }

    /**
     * Get current file content for real-time updates
     * @param {string} filePath - File path to read
     * @returns {Promise<Object>} File content data
     */
    async getFileContent(filePath) {
        try {
            const normalizedPath = this.normalizeFilePath(filePath);
            const content = await fs.readFile(normalizedPath, 'utf8');
            const stats = await fs.stat(normalizedPath);
            
            return {
                content,
                path: normalizedPath,
                modified: stats.mtime.toISOString(),
                size: stats.size
            };
        } catch (error) {
            throw new Error(`Failed to read file: ${error.message}`);
        }
    }

    /**
     * Notify all subscribers of a file change event
     * @param {string} eventType - Type of event (fileChanged, fileAdded, etc.)
     * @param {string|Object} data - Event data
     */
    async notifySubscribers(eventType, data) {
        if (this.subscribers.size === 0) return;

        let eventData = { type: eventType, data };

        // For file change events, include the updated content
        if (eventType === 'fileChanged' && typeof data === 'string') {
            try {
                const fileContent = await this.getFileContent(data);
                eventData = {
                    type: eventType,
                    file: fileContent
                };
            } catch (error) {
                console.error(`Failed to get file content for notification: ${error.message}`);
                eventData = {
                    type: 'fileError',
                    data: { path: data, error: error.message }
                };
            }
        }

        // Send to all connected clients
        this.subscribers.forEach(socket => {
            try {
                socket.emit('fileUpdate', eventData);
            } catch (error) {
                console.error(`Failed to send file update to client: ${error.message}`);
                // Remove disconnected socket
                this.subscribers.delete(socket);
            }
        });
    }

    /**
     * Normalize file path for proper Unicode handling
     * Handles macOS NFD normalization issues with Korean characters
     * @param {string} filePath - File path to normalize
     * @returns {string} Normalized file path
     */
    normalizeFilePath(filePath) {
        // Normalize Unicode to NFC (Normalization Form Composed)
        // This is important for Korean characters on macOS
        let normalized = filePath.normalize('NFC');
        
        // Additional normalization for path separators
        normalized = path.normalize(normalized);
        
        return normalized;
    }

    /**
     * Check if a file is a markdown file
     * @param {string} filePath - File path to check
     * @returns {boolean} True if markdown file
     */
    isMarkdownFile(filePath) {
        const normalizedPath = this.normalizeFilePath(filePath);
        const ext = path.extname(normalizedPath).toLowerCase();
        return ['.md', '.markdown', '.mdown', '.mkd', '.mkdn'].includes(ext);
    }

    /**
     * Get list of currently watched directories
     * @returns {Array<string>} Array of watched directory paths
     */
    getWatchedDirectories() {
        return Array.from(this.watchers.keys());
    }

    /**
     * Get watcher statistics
     * @returns {Object} Watcher statistics
     */
    getStats() {
        return {
            watchedDirectories: this.watchers.size,
            activeSubscribers: this.subscribers.size,
            directories: this.getWatchedDirectories()
        };
    }
}

module.exports = new FileWatcher();
