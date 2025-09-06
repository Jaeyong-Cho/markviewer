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
        if (this.watchers.has(rootPath)) {
            console.log(`Already watching directory: ${rootPath}`);
            return;
        }

        console.log(`Starting file watcher for: ${rootPath}`);

        const watcher = chokidar.watch(rootPath, {
            ignored: [
                '**/.git/**',
                '**/node_modules/**',
                '**/.DS_Store',
                '**/Thumbs.db',
                '**/*.tmp',
                '**/*.temp',
                '**/.*' // Hidden files except markdown
            ],
            persistent: true,
            ignoreInitial: true,
            followSymlinks: false,
            depth: undefined, // Watch all subdirectories
            awaitWriteFinish: {
                stabilityThreshold: 100,
                pollInterval: 50
            }
        });

        // File added
        watcher.on('add', (filePath) => {
            if (this.isMarkdownFile(filePath)) {
                console.log(`File added: ${filePath}`);
                this.notifySubscribers('fileAdded', filePath);
            }
        });

        // File changed
        watcher.on('change', (filePath) => {
            if (this.isMarkdownFile(filePath)) {
                console.log(`File changed: ${filePath}`);
                this.notifySubscribers('fileChanged', filePath);
            }
        });

        // File removed
        watcher.on('unlink', (filePath) => {
            if (this.isMarkdownFile(filePath)) {
                console.log(`File removed: ${filePath}`);
                this.notifySubscribers('fileRemoved', filePath);
            }
        });

        // Directory added
        watcher.on('addDir', (dirPath) => {
            console.log(`Directory added: ${dirPath}`);
            this.notifySubscribers('directoryAdded', dirPath);
        });

        // Directory removed
        watcher.on('unlinkDir', (dirPath) => {
            console.log(`Directory removed: ${dirPath}`);
            this.notifySubscribers('directoryRemoved', dirPath);
        });

        // Error handling
        watcher.on('error', (error) => {
            console.error(`File watcher error: ${error}`);
            this.notifySubscribers('watcherError', { error: error.message });
        });

        // Ready event
        watcher.on('ready', () => {
            console.log(`File watcher ready for: ${rootPath}`);
            this.notifySubscribers('watcherReady', rootPath);
        });

        this.watchers.set(rootPath, watcher);
    }

    /**
     * Stop watching a directory
     * @param {string} rootPath - Root directory path to stop watching
     */
    async stopWatching(rootPath) {
        const watcher = this.watchers.get(rootPath);
        if (watcher) {
            console.log(`Stopping file watcher for: ${rootPath}`);
            await watcher.close();
            this.watchers.delete(rootPath);
            this.notifySubscribers('watcherStopped', rootPath);
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
            const content = await fs.readFile(filePath, 'utf8');
            const stats = await fs.stat(filePath);
            
            return {
                content,
                path: filePath,
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
     * Check if a file is a markdown file
     * @param {string} filePath - File path to check
     * @returns {boolean} True if markdown file
     */
    isMarkdownFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
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
