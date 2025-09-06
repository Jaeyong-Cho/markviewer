#!/usr/bin/env node

/**
 * Universal MarkViewer Starter
 * Cross-platform starter script for MarkViewer application
 * Handles dependency checking, port management, and process coordination
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

class MarkViewerStarter {
    constructor() {
        this.backendProcess = null;
        this.frontendProcess = null;
        this.backendPort = 3001;
        this.frontendPort = 8080;
        this.testMode = process.argv.includes('--test');
        this.noAutoOpen = process.argv.includes('--no-browser') || process.env.NO_BROWSER === 'true';
    }

    /**
     * Main startup sequence
     */
    async start() {
        console.log('🚀 Starting MarkViewer...');
        console.log('');

        try {
            // Step 1: Verify Node.js
            await this.checkNodeJs();
            
            // Step 2: Check dependencies
            await this.checkDependencies();
            
            // Step 3: Find available ports
            await this.findAvailablePorts();
            
            // Step 4: Start backend
            await this.startBackend();
            
            // Step 5: Start frontend (if needed)
            await this.startFrontend();
            
            // Step 6: Setup shutdown handlers
            this.setupShutdownHandlers();
            
            console.log('✅ MarkViewer is ready!');
            
            if (this.testMode) {
                console.log('🧪 Test mode - shutting down...');
                await this.shutdown();
                process.exit(0);
            }
            
        } catch (error) {
            console.error('❌ Failed to start MarkViewer:', error.message);
            process.exit(1);
        }
    }

    /**
     * Check Node.js availability
     */
    async checkNodeJs() {
        return new Promise((resolve, reject) => {
            exec('node --version', (error, stdout) => {
                if (error) {
                    reject(new Error('Node.js is not installed or not in PATH'));
                    return;
                }
                
                const version = stdout.trim();
                console.log(`✓ Node.js detected: ${version}`);
                
                // Check for minimum version (v14)
                const majorVersion = parseInt(version.match(/v(\d+)/)[1]);
                if (majorVersion < 14) {
                    reject(new Error(`Node.js v14+ required, found ${version}`));
                    return;
                }
                
                resolve();
            });
        });
    }

    /**
     * Check and install dependencies if needed
     */
    async checkDependencies() {
        console.log('📦 Checking dependencies...');
        
        const directories = ['backend', 'frontend'];
        
        for (const dir of directories) {
            const nodeModulesPath = path.join(__dirname, dir, 'node_modules');
            const packageJsonPath = path.join(__dirname, dir, 'package.json');
            
            if (!fs.existsSync(nodeModulesPath) && fs.existsSync(packageJsonPath)) {
                console.log(`📥 Installing dependencies for ${dir}...`);
                await this.installDependencies(dir);
            } else {
                console.log(`✓ Dependencies ready for ${dir}`);
            }
        }
    }

    /**
     * Install dependencies for a specific directory
     */
    async installDependencies(directory) {
        return new Promise((resolve, reject) => {
            const child = spawn('npm', ['install'], {
                cwd: path.join(__dirname, directory),
                stdio: 'inherit'
            });
            
            child.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Failed to install dependencies for ${directory}`));
                }
            });
        });
    }

    /**
     * Find available ports for backend and frontend
     */
    async findAvailablePorts() {
        console.log('🔍 Finding available ports...');
        
        this.backendPort = await this.findAvailablePort(3001);
        this.frontendPort = await this.findAvailablePort(8080);
        
        console.log(`✓ Backend will use port: ${this.backendPort}`);
        console.log(`✓ Frontend will use port: ${this.frontendPort}`);
    }

    /**
     * Find an available port starting from the given port
     */
    async findAvailablePort(startPort) {
        for (let port = startPort; port < startPort + 100; port++) {
            if (await this.isPortFree(port)) {
                return port;
            }
        }
        throw new Error(`No available ports found starting from ${startPort}`);
    }

    /**
     * Check if a port is free
     */
    async isPortFree(port) {
        return new Promise((resolve) => {
            const server = http.createServer();
            
            server.listen(port, (err) => {
                if (err) {
                    resolve(false);
                } else {
                    server.close();
                    resolve(true);
                }
            });
            
            server.on('error', () => {
                resolve(false);
            });
        });
    }

    /**
     * Start the backend server
     */
    async startBackend() {
        console.log('🔧 Starting backend server...');
        
        return new Promise((resolve, reject) => {
            const env = { 
                ...process.env, 
                PORT: this.backendPort.toString(),
                NO_BROWSER: this.noAutoOpen ? 'true' : 'false'
            };
            
            this.backendProcess = spawn('node', ['server.js'], {
                cwd: path.join(__dirname, 'backend'),
                env: env,
                stdio: 'inherit'
            });
            
            this.backendProcess.on('error', (error) => {
                reject(new Error(`Failed to start backend: ${error.message}`));
            });
            
            // Wait a moment for backend to start
            setTimeout(() => {
                if (this.backendProcess && !this.backendProcess.killed) {
                    console.log(`✓ Backend server started on port ${this.backendPort}`);
                    resolve();
                } else {
                    reject(new Error('Backend process died during startup'));
                }
            }, 2000);
        });
    }

    /**
     * Start the frontend server (if needed)
     */
    async startFrontend() {
        // Check if backend is serving frontend
        const backendServingFrontend = await this.checkBackendFrontend();
        
        if (backendServingFrontend) {
            console.log('✓ Frontend is served by backend server');
            return;
        }
        
        console.log('🌐 Starting frontend server...');
        
        return new Promise((resolve, reject) => {
            this.frontendProcess = spawn('python3', [
                '../scripts/dev-server.py', 
                this.frontendPort.toString(), 
                '.'
            ], {
                cwd: path.join(__dirname, 'frontend'),
                stdio: 'inherit'
            });
            
            this.frontendProcess.on('error', (error) => {
                reject(new Error(`Failed to start frontend: ${error.message}`));
            });
            
            // Wait a moment for frontend to start
            setTimeout(() => {
                if (this.frontendProcess && !this.frontendProcess.killed) {
                    console.log(`✓ Frontend server started on port ${this.frontendPort}`);
                    resolve();
                } else {
                    reject(new Error('Frontend process died during startup'));
                }
            }, 1500);
        });
    }

    /**
     * Check if backend is serving frontend
     */
    async checkBackendFrontend() {
        return new Promise((resolve) => {
            const options = {
                hostname: 'localhost',
                port: this.backendPort,
                path: '/',
                method: 'GET',
                timeout: 1000
            };
            
            const req = http.request(options, (res) => {
                resolve(res.statusCode === 200);
            });
            
            req.on('error', () => {
                resolve(false);
            });
            
            req.on('timeout', () => {
                resolve(false);
            });
            
            req.end();
        });
    }

    /**
     * Setup graceful shutdown handlers
     */
    setupShutdownHandlers() {
        const signals = ['SIGINT', 'SIGTERM'];
        
        signals.forEach((signal) => {
            process.on(signal, async () => {
                console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
                await this.shutdown();
                process.exit(0);
            });
        });
    }

    /**
     * Shutdown all processes
     */
    async shutdown() {
        console.log('🔄 Stopping servers...');
        
        if (this.frontendProcess) {
            this.frontendProcess.kill();
            console.log('✓ Frontend server stopped');
        }
        
        if (this.backendProcess) {
            this.backendProcess.kill();
            console.log('✓ Backend server stopped');
        }
    }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start the application
if (require.main === module) {
    const starter = new MarkViewerStarter();
    starter.start();
}

module.exports = MarkViewerStarter;
