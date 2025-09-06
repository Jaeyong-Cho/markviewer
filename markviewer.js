#!/usr/bin/env node

/**
 * Simple MarkViewer Launcher (Legacy)
 * This file exists for backward compatibility
 * The main entry point is now start.js
 */

console.log('ℹ️  This is the legacy launcher. Please use the main entry point:');
console.log('   node start.js [options]');
console.log('   or: ./start.js [options]');
console.log('');
console.log('For help: node start.js --help');

// Redirect to start.js with the same arguments
const { spawn } = require('child_process');
const startProcess = spawn('node', ['start.js', ...process.argv.slice(2)], {
    stdio: 'inherit',
    cwd: __dirname
});

startProcess.on('exit', (code) => {
    process.exit(code);
});
