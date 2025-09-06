#!/usr/bin/env node

// Simple test to verify our CLI parsing works
const { spawn } = require('child_process');
const path = require('path');

// Parse command line arguments
function parseArguments() {
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
            console.log('Test CLI - parsing works!');
            process.exit(0);
        }
    }
    
    return options;
}

const options = parseArguments();
console.log('✅ CLI parsing successful!');
console.log(`Host: ${options.host}`);
console.log(`Port: ${options.port || 'auto-detect'}`);

// Test backend server starting with options
console.log('\n🔧 Testing backend server startup...');
const serverProcess = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, 'backend'),
    env: { 
        ...process.env, 
        PORT: (options.port || 3001).toString(),
        HOST: options.host
    },
    stdio: 'inherit'
});

// Kill after 3 seconds
setTimeout(() => {
    console.log('\n✅ Test completed - killing server');
    serverProcess.kill();
    process.exit(0);
}, 3000);
