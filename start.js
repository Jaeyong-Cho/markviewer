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
        this.noBrowser = process.argv.includes('--no-browser');
        this.isPackaged = this.checkIfPackaged();
        this.appDir = this.getAppDirectory();
        
        // Parse command line arguments for host and port
        this.cliOptions = this.parseArguments();
        
        // Override default ports/host with CLI options
        if (this.cliOptions.port) {
            this.backendPort = this.cliOptions.port;
        }
        this.host = this.cliOptions.host;
    }

    /**
     * Parse command line arguments
     */
    parseArguments() {
        const args = process.argv.slice(2);
        const options = {
            host: '127.0.0.1', // Default to localhost
            port: null         // Will use auto-detection if not specified
        };
        
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            
            if (arg === '-i' || arg === '--interface') {
                if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
                    options.host = args[i + 1];
                    i++; // Skip next argument as it's the value
                } else {
                    console.error('❌ Error: -i option requires a host value');
                    process.exit(1);
                }
            } else if (arg === '-p' || arg === '--port') {
                if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
                    const portValue = parseInt(args[i + 1], 10);
                    if (isNaN(portValue) || portValue < 1 || portValue > 65535) {
                        console.error('❌ Error: Invalid port number. Must be between 1 and 65535');
                        process.exit(1);
                    }
                    options.port = portValue;
                    i++; // Skip next argument as it's the value
                } else {
                    console.error('❌ Error: -p option requires a port number');
                    process.exit(1);
                }
            } else if (arg === '-h' || arg === '--help') {
                this.showHelp();
                process.exit(0);
            } else if (arg !== '--test' && arg !== '--no-browser') {
                // Ignore known options, show error for unknown ones
                console.error(`❌ Error: Unknown option '${arg}'`);
                console.error('Use -h or --help for usage information');
                process.exit(1);
            }
        }
        
        return options;
    }

    /**
     * Show help message
     */
    showHelp() {
        console.log('MarkViewer - A web-based markdown viewer');
        console.log('');
        console.log('Usage:');
        console.log('  markviewer [options]');
        console.log('');
        console.log('Options:');
        console.log('  -i, --interface <host>  Interface to bind to (default: 127.0.0.1)');
        console.log('  -p, --port <port>       Port to listen on (default: auto-detect starting from 3001)');
        console.log('  --no-browser            Don\'t open browser automatically');
        console.log('  --test                  Test mode (start and immediately shutdown)');
        console.log('  -h, --help              Show this help message');
        console.log('');
        console.log('Examples:');
        console.log('  markviewer                     # Start on localhost with auto-detected port');
        console.log('  markviewer -i 0.0.0.0          # Listen on all interfaces');
        console.log('  markviewer -p 8080             # Use specific port');
        console.log('  markviewer -i 0.0.0.0 -p 2345  # Custom interface and port');
    }

    /**
     * Check if running as a packaged executable
     */
    checkIfPackaged() {
        return process.pkg !== undefined;
    }

    /**
     * Get the application directory (different for packaged vs development)
     */
    getAppDirectory() {
        if (this.isPackaged) {
            // When packaged, assets are embedded and __dirname points to the executable
            return path.dirname(process.execPath);
        } else {
            // In development, use the script directory
            return __dirname;
        }
    }

    /**
     * Main startup sequence
     */
    async start() {
        console.log('🚀 Starting MarkViewer...');
        console.log(`📡 Interface: ${this.host}`);
        if (this.cliOptions.port) {
            console.log(`🔌 Port: ${this.cliOptions.port}`);
        } else {
            console.log(`🔌 Port: auto-detect (starting from 3001)`);
        }
        console.log('');

        try {
            // Step 1: Verify environment
            if (!this.isPackaged) {
                await this.checkNodeJs();
            } else {
                console.log('✓ Running as packaged executable');
            }
            
            // Step 2: Check dependencies (skip for packaged)
            if (!this.isPackaged) {
                await this.checkDependencies();
            } else {
                console.log('✓ Dependencies bundled in executable');
            }
            
            // Step 3: Find available ports
            await this.findAvailablePorts();
            
            // Step 4: Start backend
            await this.startBackend();
            
            // Step 5: Start frontend (if needed)
            await this.startFrontend();
            
            // Step 6: Setup shutdown handlers
            this.setupShutdownHandlers();
            
            console.log('✅ MarkViewer is ready!');
            console.log('');
            
            const displayHost = this.host === '0.0.0.0' ? 'localhost' : this.host;
            console.log(`🌐 Web interface: http://${displayHost}:${this.backendPort}`);
            console.log('');
            
            // Open browser if not disabled
            if (!this.noBrowser && !this.testMode) {
                await this.openBrowser();
            }
            
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
     * Open browser automatically
     */
    async openBrowser() {
        const displayHost = this.host === '0.0.0.0' ? 'localhost' : this.host;
        const url = `http://${displayHost}:${this.backendPort}`;
        const { exec } = require('child_process');
        
        let command;
        switch (process.platform) {
            case 'darwin': // macOS
                command = `open "${url}"`;
                break;
            case 'win32': // Windows
                command = `start "${url}"`;
                break;
            default: // Linux and others
                command = `xdg-open "${url}"`;
                break;
        }
        
        try {
            await new Promise((resolve, reject) => {
                exec(command, (error) => {
                    if (error) {
                        console.log('⚠️  Could not open browser automatically');
                        console.log(`   Please open: ${url}`);
                        resolve();
                    } else {
                        console.log('🌐 Browser opened automatically');
                        resolve();
                    }
                });
            });
        } catch (error) {
            console.log('⚠️  Could not open browser automatically');
            console.log(`   Please open: ${url}`);
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
        
        // If port is specified via CLI, use it directly or check if available
        if (this.cliOptions.port) {
            if (await this.isPortFree(this.cliOptions.port)) {
                this.backendPort = this.cliOptions.port;
                console.log(`✓ Using specified port: ${this.backendPort}`);
            } else {
                throw new Error(`Specified port ${this.cliOptions.port} is already in use`);
            }
        } else {
            this.backendPort = await this.findAvailablePort(3001);
            console.log(`✓ Backend will use port: ${this.backendPort}`);
        }
        
        this.frontendPort = await this.findAvailablePort(8080);
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
                HOST: this.host,
                MARKVIEWER_APP_DIR: this.appDir
            };
            
            if (this.isPackaged) {
                // For packaged executable, start backend in the same process
                try {
                    const server = require('./backend/server.js');
                    setTimeout(() => {
                        console.log(`✓ Backend server started on port ${this.backendPort}`);
                        resolve();
                    }, 1000);
                } catch (error) {
                    reject(new Error(`Failed to start backend: ${error.message}`));
                }
            } else {
                // For development, run backend as separate process
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
            }
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
