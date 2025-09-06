/**
 * WebSocket client for real-time file updates
 * Handles connection to the backend file watcher service
 */
class WebSocketClient extends Utils.EventEmitter {
    constructor() {
        super();
        this.socket = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Start with 1 second
        this.maxReconnectDelay = 30000; // Max 30 seconds
        
        // Check if Socket.IO is available
        if (typeof io === 'undefined') {
            console.warn('Socket.IO not available, real-time updates disabled');
            return;
        }
        
        // Auto-connect when initialized
        this.connect();
    }

    /**
     * Connect to the WebSocket server
     */
    connect() {
        if (this.socket && this.connected) {
            return;
        }

        // Check if Socket.IO is available
        if (typeof io === 'undefined') {
            console.warn('Socket.IO not available, skipping WebSocket connection');
            return;
        }

        try {
            console.log('Connecting to WebSocket server...');
            
            // Connect to backend server (assume it's running on port 3001)
            const serverUrl = `${window.location.protocol}//${window.location.hostname}:3001`;
            
            this.socket = io(serverUrl, {
                transports: ['websocket', 'polling'],
                timeout: 5000,
                forceNew: true,
                autoConnect: true,
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: this.reconnectDelay
            });

            this.setupEventHandlers();
            
        } catch (error) {
            console.error('Failed to connect to WebSocket server:', error);
            this.scheduleReconnect();
        }
    }

    /**
     * Setup Socket.IO event handlers
     */
    setupEventHandlers() {
        if (!this.socket) return;

        // Connection established
        this.socket.on('connect', () => {
            console.log('WebSocket connected successfully');
            this.connected = true;
            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;
            
            this.emit('connected');
            Utils.showNotification('Real-time file updates enabled', 'success');
        });

        // Connection lost
        this.socket.on('disconnect', (reason) => {
            console.log('WebSocket disconnected:', reason);
            this.connected = false;
            
            this.emit('disconnected', reason);
            
            if (reason === 'io server disconnect') {
                // Server disconnected, don't reconnect automatically
                Utils.showNotification('Server disconnected', 'warning');
            } else {
                // Network issue, try to reconnect
                Utils.showNotification('Connection lost, attempting to reconnect...', 'warning');
                this.scheduleReconnect();
            }
        });

        // Connection error
        this.socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            this.connected = false;
            
            this.emit('connectionError', error);
            this.scheduleReconnect();
        });

        // Welcome message from server
        this.socket.on('connected', (data) => {
            console.log('Server welcome message:', data);
        });

        // File update events
        this.socket.on('fileUpdate', (eventData) => {
            console.log('File update received:', eventData);
            this.handleFileUpdate(eventData);
        });

        // Reconnection success
        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`WebSocket reconnected after ${attemptNumber} attempts`);
            this.connected = true;
            this.reconnectAttempts = 0;
            
            this.emit('reconnected', attemptNumber);
            Utils.showNotification('Connection restored', 'success');
        });

        // Reconnection attempts
        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`WebSocket reconnection attempt ${attemptNumber}`);
        });

        // Reconnection failed
        this.socket.on('reconnect_failed', () => {
            console.error('WebSocket reconnection failed');
            this.emit('reconnectFailed');
            Utils.showNotification('Unable to restore connection to server', 'error');
        });
    }

    /**
     * Handle file update events from the server
     * @param {Object} eventData - File update event data
     */
    handleFileUpdate(eventData) {
        const { type, file, data } = eventData;

        switch (type) {
            case 'fileChanged':
                this.emit('fileChanged', file);
                this.showFileChangeNotification(file.path);
                break;
                
            case 'fileAdded':
                this.emit('fileAdded', data);
                this.showFileChangeNotification(data, 'added');
                break;
                
            case 'fileRemoved':
                this.emit('fileRemoved', data);
                this.showFileChangeNotification(data, 'removed');
                break;
                
            case 'directoryAdded':
                this.emit('directoryAdded', data);
                break;
                
            case 'directoryRemoved':
                this.emit('directoryRemoved', data);
                break;
                
            case 'fileError':
                this.emit('fileError', data);
                console.error('File error:', data);
                Utils.showNotification(`File error: ${data.error}`, 'error');
                break;
                
            case 'watcherReady':
                this.emit('watcherReady', data);
                console.log('File watcher ready for:', data);
                break;
                
            case 'watcherStopped':
                this.emit('watcherStopped', data);
                console.log('File watcher stopped for:', data);
                break;
                
            case 'watcherError':
                this.emit('watcherError', data);
                console.error('File watcher error:', data);
                Utils.showNotification(`File watcher error: ${data.error}`, 'error');
                break;
                
            default:
                console.log('Unknown file update event:', type, eventData);
        }
    }

    /**
     * Show file change notification
     * @param {string} filePath - Path of changed file
     * @param {string} action - Action type (changed, added, removed)
     */
    showFileChangeNotification(filePath, action = 'changed') {
        const fileName = filePath.split('/').pop();
        const message = `File ${action}: ${fileName}`;
        
        // Only show brief notifications for file changes
        Utils.showNotification(message, 'info', 2000);
    }

    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            Utils.showNotification('Connection failed. Please refresh the page.', 'error', 0);
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
        
        console.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
            if (!this.connected) {
                this.connect();
            }
        }, delay);
    }

    /**
     * Get file watcher statistics from server
     * @returns {Promise<Object>} Watcher statistics
     */
    async getWatcherStats() {
        return new Promise((resolve, reject) => {
            if (!this.connected || !this.socket) {
                reject(new Error('WebSocket not connected'));
                return;
            }

            this.socket.emit('getWatcherStats', (stats) => {
                resolve(stats);
            });

            // Timeout after 5 seconds
            setTimeout(() => {
                reject(new Error('Timeout waiting for watcher stats'));
            }, 5000);
        });
    }

    /**
     * Disconnect from the WebSocket server
     */
    disconnect() {
        if (this.socket) {
            console.log('Disconnecting from WebSocket server');
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
        }
    }

    /**
     * Check if connected to WebSocket server
     * @returns {boolean} Connection status
     */
    isConnected() {
        return this.connected && this.socket && this.socket.connected;
    }

    /**
     * Get connection status information
     * @returns {Object} Connection status
     */
    getConnectionInfo() {
        return {
            connected: this.connected,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            socketId: this.socket ? this.socket.id : null
        };
    }
}

// Make WebSocketClient available globally
window.WebSocketClient = WebSocketClient;
