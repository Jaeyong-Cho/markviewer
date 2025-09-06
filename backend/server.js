const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { createServer } = require('http');
const { Server } = require('socket.io');
const fileHandler = require('./services/file-handler');
const plantumlService = require('./services/plantuml-service');
const searchService = require('./services/search-service');
const fileWatcher = require('./services/file-watcher');

/**
 * Browser opening functionality has been removed
 * Users need to manually open the browser and navigate to the URL
 */

/**
 * Express server for markdown viewer backend
 * Provides APIs for file operations, PlantUML rendering, and search
 */
class MarkViewerServer {
    constructor(options = {}) {
        this.app = express();
        this.server = createServer(this.app);
        
        // Initialize Socket.IO
        this.io = new Server(this.server, {
            cors: {
                origin: function(origin, callback) {
                    // Allow requests with no origin (mobile apps, curl, etc.)
                    if (!origin) return callback(null, true);
                    
                    // Allow localhost and local network access
                    const allowedOrigins = [
                        /^https?:\/\/localhost(:\d+)?$/,
                        /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
                        /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
                        /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
                        /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+(:\d+)?$/
                    ];
                    
                    const isAllowed = allowedOrigins.some(pattern => pattern.test(origin));
                    callback(null, isAllowed);
                },
                credentials: true
            }
        });
        
        // Port configuration with multiple fallbacks
        this.port = options.port || 
                   process.argv[2] || 
                   process.env.PORT || 
                   process.env.BACKEND_PORT || 
                   3001;
        
        // Host configuration with fallback
        this.host = options.host || 
                   process.env.HOST || 
                   '127.0.0.1';
        
        // Convert to number if it's a string
        this.port = parseInt(this.port, 10);
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
    }

    /**
     * Configure Express middleware
     */
    setupMiddleware() {
        // Set default charset for responses
        this.app.use((req, res, next) => {
            res.charset = 'utf-8';
            next();
        });

        // Enable CORS for frontend communication
        this.app.use(cors({
            origin: function(origin, callback) {
                // Allow requests with no origin (mobile apps, curl, etc.)
                if (!origin) return callback(null, true);
                
                // Allow localhost and local network access
                const allowedOrigins = [
                    /^https?:\/\/localhost(:\d+)?$/,
                    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
                    /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
                    /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
                    /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+(:\d+)?$/
                ];
                
                const isAllowed = allowedOrigins.some(pattern => pattern.test(origin));
                callback(null, isAllowed);
            },
            credentials: true
        }));

        // Parse JSON request bodies with UTF-8 encoding
        this.app.use(express.json({ 
            limit: '10mb',
            type: 'application/json'
        }));
        this.app.use(express.urlencoded({ 
            extended: true, 
            limit: '10mb'
        }));

        // Serve static files from frontend directory
        const frontendPath = path.join(__dirname, '..', 'frontend');
        this.app.use(express.static(frontendPath));

        // Log requests in development
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    /**
     * Configure API routes
     */
    setupRoutes() {
        // Health check endpoint
        this.app.get('/api/health', (req, res) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        });

        // Directory tree endpoint
        this.app.get('/api/directory', async (req, res) => {
            try {
                const rootPath = req.query.path;
                if (!rootPath) {
                    return res.status(400).json({ error: 'Path parameter is required' });
                }

                const directoryTree = await fileHandler.getDirectoryTree(rootPath);
                
                // Start file watcher for this directory
                fileWatcher.startWatching(rootPath);
                
                res.json(directoryTree);
            } catch (error) {
                console.error('Error getting directory tree:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // File content endpoint
        this.app.get('/api/file', async (req, res) => {
            try {
                const filePath = req.query.path;
                if (!filePath) {
                    return res.status(400).json({ error: 'Path parameter is required' });
                }

                const content = await fileHandler.getFileContent(filePath);
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.json({ content, path: filePath });
            } catch (error) {
                console.error('Error reading file:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // PlantUML rendering endpoint
        this.app.post('/api/plantuml', async (req, res) => {
            try {
                const { source } = req.body;
                if (!source) {
                    return res.status(400).json({ error: 'PlantUML source is required' });
                }

                const svg = await plantumlService.renderToSVG(source);
                res.json({ svg });
            } catch (error) {
                console.error('PlantUML rendering error:', error);
                res.status(500).json({ 
                    error: 'PlantUML rendering failed',
                    details: error.message 
                });
            }
        });

        // Search endpoint
        this.app.get('/api/search', async (req, res) => {
            try {
                const { query, path } = req.query;
                
                if (!query) {
                    return res.status(400).json({ error: 'Search query is required' });
                }
                if (!path) {
                    return res.status(400).json({ error: 'Search path is required' });
                }

                const searchResults = await searchService.searchFiles(query, path);
                console.log('Search service response:', JSON.stringify(searchResults, null, 2));
                
                res.json(searchResults);
            } catch (error) {
                console.error('Search error:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Image serving endpoint for markdown-relative images
        this.app.get('/api/image', async (req, res) => {
            try {
                const { imagePath, markdownPath } = req.query;
                
                if (!imagePath) {
                    return res.status(400).json({ error: 'Image path parameter is required' });
                }

                // Resolve image path relative to markdown file
                let resolvedImagePath = imagePath;
                
                if (markdownPath && !path.isAbsolute(imagePath)) {
                    // Get directory of the markdown file
                    const markdownDir = path.dirname(markdownPath);
                    // Resolve image path relative to markdown directory
                    resolvedImagePath = path.resolve(markdownDir, imagePath);
                }

                // Security: Ensure the resolved path doesn't escape using path traversal
                const normalizedPath = path.normalize(resolvedImagePath);
                if (normalizedPath.includes('..')) {
                    return res.status(403).json({ error: 'Invalid image path' });
                }

                // Check if file exists and is an image
                const fs = require('fs').promises;
                try {
                    await fs.access(normalizedPath);
                } catch (error) {
                    return res.status(404).json({ error: 'Image file not found' });
                }

                // Get file extension to determine content type
                const ext = path.extname(normalizedPath).toLowerCase();
                const imageTypes = {
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.gif': 'image/gif',
                    '.svg': 'image/svg+xml',
                    '.webp': 'image/webp',
                    '.bmp': 'image/bmp',
                    '.ico': 'image/x-icon'
                };

                const contentType = imageTypes[ext];
                if (!contentType) {
                    return res.status(400).json({ error: 'Unsupported image format' });
                }

                // Set appropriate headers
                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

                // Send the image file
                res.sendFile(normalizedPath);
                
            } catch (error) {
                console.error('Error serving image:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // File watcher stats endpoint
        this.app.get('/api/watcher/stats', (req, res) => {
            try {
                const stats = fileWatcher.getStats();
                res.json(stats);
            } catch (error) {
                console.error('Error getting watcher stats:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Serve frontend for all other routes (SPA support)
        this.app.get('*', (req, res) => {
            const frontendPath = path.join(__dirname, '..', 'frontend', 'index.html');
            res.sendFile(frontendPath);
        });

        // Error handling middleware
        this.app.use((error, req, res, next) => {
            console.error('Unhandled error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        });
    }

    /**
     * Setup WebSocket connections for real-time file updates
     */
    setupWebSocket() {
        this.io.on('connection', (socket) => {
            console.log(`Client connected: ${socket.id}`);
            
            // Add client to file watcher subscribers
            fileWatcher.addSubscriber(socket);
            
            // Handle client requests for watcher stats
            socket.on('getWatcherStats', (callback) => {
                const stats = fileWatcher.getStats();
                if (callback && typeof callback === 'function') {
                    callback(stats);
                }
            });
            
            // Handle client disconnect
            socket.on('disconnect', () => {
                console.log(`Client disconnected: ${socket.id}`);
            });
            
            // Send welcome message
            socket.emit('connected', {
                message: 'Connected to MarkViewer file watcher',
                timestamp: new Date().toISOString()
            });
        });
        
        console.log('WebSocket server initialized for real-time file updates');
    }

    /**
     * Start the server
     */
    start() {
        this.server.listen(this.port, this.host, () => {
            const displayHost = this.host === '0.0.0.0' ? 'localhost' : this.host;
            const url = `http://${displayHost}:${this.port}`;
            console.log(`🚀 MarkViewer server running on http://${this.host}:${this.port}`);
            console.log(`📱 Frontend available at ${url}`);
            console.log(`🔧 API available at http://${this.host}:${this.port}/api`);
            console.log(`🔄 WebSocket available for real-time updates`);
            
            if (this.host === '0.0.0.0') {
                console.log(`🌍 External access: http://<your-ip>:${this.port}`);
            }
            
            console.log('');
            console.log('✅ Server ready!');
            console.log(`   Please open your browser and navigate to: ${url}`);
        });
        
        // Graceful shutdown
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
    }
    
    /**
     * Graceful shutdown
     */
    async shutdown() {
        console.log('Shutting down server...');
        
        // Stop all file watchers
        await fileWatcher.stopAllWatchers();
        
        // Close WebSocket connections
        this.io.close();
        
        // Close HTTP server
        this.server.close(() => {
            console.log('Server shut down complete');
            process.exit(0);
        });
    }
}

// Create and start server
const options = {};

// Check for command line arguments or environment variables
const args = process.argv.slice(2);
if (args.length > 0) {
    const port = parseInt(args[0], 10);
    if (!isNaN(port) && port > 0 && port <= 65535) {
        options.port = port;
    } else {
        console.error('Invalid port number. Using default port.');
    }
}

// Check for environment variables
if (process.env.HOST) {
    options.host = process.env.HOST;
}

const server = new MarkViewerServer(options);
server.start();

module.exports = MarkViewerServer;
