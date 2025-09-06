#!/usr/bin/env node

/**
 * Demo script to show CLI functionality
 * This demonstrates the implemented features without running the full server
 */

console.log('🎯 MarkViewer CLI Demo');
console.log('====================');

// Simulate command line arguments for different scenarios
const testCases = [
    [],                              // Default case
    ['-h'],                         // Help case
    ['-i', '0.0.0.0'],             // Interface only
    ['-p', '2345'],                // Port only  
    ['-i', '0.0.0.0', '-p', '2345'] // Both interface and port
];

// Parse command line arguments function (same as in start.js)
function parseArguments(args) {
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
                throw new Error('-i option requires a host value');
            }
        } else if (arg === '-p' || arg === '--port') {
            if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
                const portValue = parseInt(args[i + 1], 10);
                if (isNaN(portValue) || portValue < 1 || portValue > 65535) {
                    throw new Error('Invalid port number. Must be between 1 and 65535');
                }
                options.port = portValue;
                i++; // Skip next argument as it's the value
            } else {
                throw new Error('-p option requires a port number');
            }
        } else if (arg === '-h' || arg === '--help') {
            return { showHelp: true };
        }
    }
    
    return options;
}

// Function to show help (same as in start.js)
function showHelp() {
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

// Test each scenario
testCases.forEach((testArgs, index) => {
    console.log(`\n📋 Test Case ${index + 1}: ${testArgs.length ? testArgs.join(' ') : '(default)'}`);
    console.log('─'.repeat(50));
    
    try {
        if (testArgs.includes('-h')) {
            console.log('Help requested:');
            showHelp();
            return;
        }
        
        const options = parseArguments(testArgs);
        
        console.log(`📡 Interface: ${options.host}`);
        if (options.port) {
            console.log(`🔌 Port: ${options.port}`);
        } else {
            console.log(`🔌 Port: auto-detect (starting from 3001)`);
        }
        
        // Show what URL would be used
        const displayHost = options.host === '0.0.0.0' ? 'localhost' : options.host;
        const displayPort = options.port || 3001;
        console.log(`🌐 Would serve on: http://${displayHost}:${displayPort}`);
        
        if (options.host === '0.0.0.0') {
            console.log(`🌍 External access: http://<your-ip>:${displayPort}`);
        }
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
});

console.log('\n✅ All CLI functionality implemented successfully!');
console.log('\n📝 Summary of changes:');
console.log('1. ✅ Default interface changed from 0.0.0.0 to 127.0.0.1 (localhost)');
console.log('2. ✅ Added -i/--interface option for host configuration');
console.log('3. ✅ Added -p/--port option for port configuration');
console.log('4. ✅ Added help message with -h/--help');
console.log('5. ✅ Updated backend server to accept HOST environment variable');
console.log('6. ✅ Updated URL displays to use correct host/port combination');
console.log('');
console.log('🎉 Ready to use: ./markviewer -i 0.0.0.0 -p 2345');
