#!/usr/bin/env node

/**
 * Simple MarkViewer Launcher
 * Quick start script that uses the backend server to serve everything
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting MarkViewer...');
console.log('');

// Find an available port starting from 3001
const findPort = async (startPort) => {
    const net = require('net');
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(startPort, (err) => {
            if (err) {
                server.close();
                findPort(startPort + 1).then(resolve);
            } else {
                const port = server.address().port;
                server.close();
                resolve(port);
            }
        });
    });
};

// Main execution
(async () => {
    try {
        const port = await findPort(3001);
        
        console.log(`📡 Starting server on port ${port}...`);
        
        const serverProcess = spawn('node', ['server.js'], {
            cwd: path.join(__dirname, 'backend'),
            env: { 
                ...process.env, 
                PORT: port.toString()
            },
            stdio: 'inherit'
        });
        
        // Handle graceful shutdown
        ['SIGINT', 'SIGTERM'].forEach((signal) => {
            process.on(signal, () => {
                console.log(`\n🛑 Shutting down...`);
                serverProcess.kill();
                process.exit(0);
            });
        });
        
        serverProcess.on('error', (error) => {
            console.error('❌ Failed to start server:', error.message);
            process.exit(1);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();
