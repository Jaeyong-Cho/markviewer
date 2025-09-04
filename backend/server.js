const express = require('express');
const cors = require('cors');
const path = require('path');
const fileHandler = require('./services/file-handler');
const plantumlService = require('./services/plantuml-service');
const searchService = require('./services/search-service');

/**
 * Express server for markdown viewer backend
 * Provides APIs for file operations, PlantUML rendering, and search
 */
class MarkViewerServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3001;
        this.setupMiddleware();
        this.setupRoutes();
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
            origin: ['http://localhost:8080', 'http://127.0.0.1:8080'],
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

                const results = await searchService.searchFiles(path, query);
                res.json({ results, query, totalResults: results.length });
            } catch (error) {
                console.error('Search error:', error);
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
     * Start the server
     */
    start() {
        this.app.listen(this.port, () => {
            console.log(`MarkViewer server running on http://localhost:${this.port}`);
            console.log(`API available at http://localhost:${this.port}/api`);
            console.log(`Frontend available at http://localhost:${this.port}`);
        });
    }
}

// Create and start server
const server = new MarkViewerServer();
server.start();

module.exports = MarkViewerServer;
