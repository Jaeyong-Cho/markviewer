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
const WorkspaceScanner = require('./services/workspace-scanner');
const LinkAnalysisService = require('./services/link-analysis-service');

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
        
        // Initialize services
        this.workspaceScanner = new WorkspaceScanner();
        this.linkAnalysisService = new LinkAnalysisService();
        
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

        // Cache management endpoints
        this.app.post('/api/cache/clear-diagrams', (req, res) => {
            try {
                // Clear PlantUML cache
                if (plantumlService && plantumlService.clearCache) {
                    plantumlService.clearCache();
                    console.log('PlantUML cache cleared');
                }
                
                res.json({ 
                    success: true, 
                    message: 'Diagram cache cleared successfully' 
                });
            } catch (error) {
                console.error('Error clearing diagram cache:', error);
                res.status(500).json({ 
                    error: 'Failed to clear diagram cache',
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

        // Workspace scanning endpoints
        
        // Start workspace scan
        this.app.post('/api/workspace/scan', async (req, res) => {
            try {
                const options = req.body || {};
                console.log('Starting workspace scan with options:', options);
                
                const scanId = await this.workspaceScanner.startScan(options);
                res.json({ 
                    scanId, 
                    status: 'started',
                    message: 'Workspace scan initiated'
                });
            } catch (error) {
                console.error('Error starting workspace scan:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Get scan progress
        this.app.get('/api/workspace/scan/:scanId', (req, res) => {
            try {
                const { scanId } = req.params;
                const progress = this.workspaceScanner.getScanProgress(scanId);
                
                if (progress.error && progress.error === 'Scan not found') {
                    return res.status(404).json({ error: 'Scan not found' });
                }
                
                res.json(progress);
            } catch (error) {
                console.error('Error getting scan progress:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Cancel scan
        this.app.delete('/api/workspace/scan/:scanId', (req, res) => {
            try {
                const { scanId } = req.params;
                this.workspaceScanner.cancelScan(scanId);
                res.json({ 
                    scanId, 
                    status: 'cancelled',
                    message: 'Scan cancelled successfully'
                });
            } catch (error) {
                console.error('Error cancelling scan:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Get cached recommendations
        this.app.get('/api/workspace/recommendations', (req, res) => {
            try {
                const recommendations = this.workspaceScanner.getCachedRecommendations();
                res.json({ 
                    recommendations,
                    count: recommendations.length,
                    cached: true
                });
            } catch (error) {
                console.error('Error getting cached recommendations:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Get directory suggestions for autocomplete
        this.app.get('/api/workspace/suggestions', async (req, res) => {
            try {
                const { path: partialPath } = req.query;
                if (!partialPath) {
                    return res.status(400).json({ error: 'Path parameter is required' });
                }

                const suggestions = await this.getDirectorySuggestions(partialPath);
                res.json({ 
                    suggestions,
                    count: suggestions.length,
                    query: partialPath
                });
            } catch (error) {
                console.error('Error getting directory suggestions:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Graph analysis endpoints
        this.app.get('/api/graph', async (req, res) => {
            try {
                const rootPath = req.query.path;
                if (!rootPath) {
                    return res.status(400).json({ error: 'Path parameter is required' });
                }

                const graphData = await this.linkAnalysisService.analyzeDirectory(rootPath);
                
                res.json({
                    success: true,
                    data: graphData,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error generating graph data:', error);
                res.status(500).json({ 
                    error: 'Failed to analyze graph relationships',
                    message: error.message 
                });
            }
        });

        this.app.post('/api/graph/analyze', async (req, res) => {
            try {
                const { path: rootPath, forceRefresh = false } = req.body;
                if (!rootPath) {
                    return res.status(400).json({ error: 'Path parameter is required' });
                }

                const graphData = await this.linkAnalysisService.analyzeDirectory(rootPath);
                const stats = this.linkAnalysisService.getStats();
                
                res.json({
                    success: true,
                    data: graphData,
                    stats: stats,
                    forceRefresh: forceRefresh,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error analyzing graph:', error);
                res.status(500).json({ 
                    error: 'Failed to analyze graph relationships',
                    message: error.message 
                });
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
        // Set up periodic cleanup for workspace scanner
        setInterval(() => {
            this.workspaceScanner.cleanup();
        }, 5 * 60 * 1000); // Clean up every 5 minutes

        this.server.listen(this.port, this.host, () => {
            const displayHost = this.host === '0.0.0.0' ? 'localhost' : this.host;
            const url = `http://${displayHost}:${this.port}`;
            console.log(`🚀 MarkViewer server running on http://${this.host}:${this.port}`);
            console.log(`📱 Frontend available at ${url}`);
            console.log(`🔧 API available at http://${this.host}:${this.port}/api`);
            console.log(`🔄 WebSocket available for real-time updates`);
            console.log(`🔍 Workspace scanning available at ${url}/api/workspace/scan`);
            
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
     * Get directory suggestions for autocomplete
     * @param {string} partialPath - Partial directory path
     * @returns {Array} Array of directory suggestions
     */
    async getDirectorySuggestions(partialPath) {
        const fs = require('fs').promises;
        const path = require('path');
        const os = require('os');
        
        try {
            const suggestions = [];
            
            // Handle empty or root-level paths
            if (!partialPath || partialPath.length === 0) {
                const homeDir = os.homedir();
                const commonDirs = ['Documents', 'Desktop', 'Downloads', 'Projects', 'dev', 'workspace'];
                
                for (const dir of commonDirs) {
                    const fullPath = path.join(homeDir, dir);
                    try {
                        const stat = await fs.stat(fullPath);
                        if (stat.isDirectory()) {
                            suggestions.push({
                                path: fullPath,
                                name: dir,
                                type: 'directory',
                                isCommon: true
                            });
                        }
                    } catch (error) {
                        // Skip directories that don't exist
                    }
                }
                
                // Add home directory itself
                suggestions.unshift({
                    path: homeDir,
                    name: path.basename(homeDir),
                    type: 'directory',
                    isHome: true
                });
                
                return suggestions.slice(0, 10);
            }
            
            // Normalize and resolve the partial path
            let basePath = path.resolve(partialPath);
            let searchName = '';
            
            // If the path doesn't exist, get the parent directory and search pattern
            try {
                const stat = await fs.stat(basePath);
                if (!stat.isDirectory()) {
                    searchName = path.basename(basePath);
                    basePath = path.dirname(basePath);
                }
            } catch (error) {
                // Path doesn't exist, treat last part as search pattern
                searchName = path.basename(basePath);
                basePath = path.dirname(basePath);
            }
            
            // Ensure base path exists
            try {
                const baseStat = await fs.stat(basePath);
                if (!baseStat.isDirectory()) {
                    return [];
                }
            } catch (error) {
                return [];
            }
            
            // Read directory contents
            const entries = await fs.readdir(basePath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                
                // Skip hidden directories (except .github, .vscode for development)
                if (entry.name.startsWith('.') && 
                    !['github', 'vscode'].includes(entry.name.substring(1).toLowerCase())) {
                    continue;
                }
                
                // Skip common exclude patterns
                const excludePatterns = [
                    'node_modules', '.git', '.svn', 'target', 'build', 'dist',
                    '.cache', 'tmp', 'temp', '__pycache__'
                ];
                if (excludePatterns.includes(entry.name.toLowerCase())) {
                    continue;
                }
                
                // Filter by search pattern if provided
                if (searchName && !entry.name.toLowerCase().includes(searchName.toLowerCase())) {
                    continue;
                }
                
                const fullPath = path.join(basePath, entry.name);
                
                // Check if directory has markdown files (quick check)
                let hasMarkdown = false;
                try {
                    const subEntries = await fs.readdir(fullPath);
                    hasMarkdown = subEntries.some(name => 
                        name.toLowerCase().endsWith('.md') || 
                        name.toLowerCase().endsWith('.markdown')
                    );
                } catch (error) {
                    // Skip directories we can't read
                    continue;
                }
                
                suggestions.push({
                    path: fullPath,
                    name: entry.name,
                    type: 'directory',
                    hasMarkdown,
                    parent: basePath
                });
            }
            
            // Sort suggestions: directories with markdown first, then alphabetically
            suggestions.sort((a, b) => {
                if (a.hasMarkdown && !b.hasMarkdown) return -1;
                if (!a.hasMarkdown && b.hasMarkdown) return 1;
                return a.name.localeCompare(b.name);
            });
            
            return suggestions.slice(0, 10);
            
        } catch (error) {
            console.error('Error getting directory suggestions:', error);
            return [];
        }
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
