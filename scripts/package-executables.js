#!/usr/bin/env node

/**
 * Cross-Platform Executable Packaging Script
 * Creates standalone executables for Windows, macOS, and Linux
 * Includes plantuml.jar and all dependencies
 */

const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const archiver = require('archiver');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ExecutablePackager {
    constructor() {
        this.packageInfo = require('../package.json');
        this.version = this.packageInfo.version;
        this.appName = this.packageInfo.name;
        this.distDir = path.join(__dirname, '..', 'dist');
        this.releaseDir = path.join(__dirname, '..', 'release');
        
        // Platform configurations
        this.platforms = {
            'win-x64': {
                name: 'Windows x64',
                target: 'node18-win-x64',
                executable: `${this.appName}.exe`,
                archiveName: `${this.appName}-${this.version}-windows-x64.zip`,
                launcher: 'markviewer.exe'
            },
            'macos-x64': {
                name: 'macOS Intel',
                target: 'node18-macos-x64',
                executable: this.appName,
                archiveName: `${this.appName}-${this.version}-macos-intel.zip`,
                launcher: 'markviewer'
            },
            'macos-arm64': {
                name: 'macOS Apple Silicon',
                target: 'node18-macos-arm64',
                executable: this.appName,
                archiveName: `${this.appName}-${this.version}-macos-arm64.zip`,
                launcher: 'markviewer'
            },
            'linux-x64': {
                name: 'Linux x64',
                target: 'node18-linux-x64',
                executable: this.appName,
                archiveName: `${this.appName}-${this.version}-linux-x64.tar.gz`,
                launcher: 'markviewer'
            }
        };
    }

    /**
     * Main packaging workflow
     */
    async package() {
        console.log('🚀 MarkViewer Executable Packaging');
        console.log('===================================');
        console.log('');

        try {
            await this.setup();
            await this.installDependencies();
            await this.ensurePlantUML();
            await this.buildExecutables();
            await this.createDistributions();
            await this.cleanup();

            console.log('');
            console.log('✅ Packaging completed successfully!');
            this.showResults();

        } catch (error) {
            console.error('❌ Packaging failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * Setup directories and verify requirements
     */
    async setup() {
        console.log('📋 Setting up packaging environment...');

        // Check pkg is available
        try {
            await execAsync('npx pkg --version');
        } catch (error) {
            throw new Error('pkg is not available. Run: npm install');
        }

        // Create directories
        await this.ensureDir(this.distDir);
        await this.ensureDir(this.releaseDir);

        console.log('✅ Environment setup complete');
    }

    /**
     * Install all dependencies
     */
    async installDependencies() {
        console.log('📦 Installing dependencies...');

        try {
            await execAsync('npm run install-all');
            console.log('✅ Dependencies installed');
        } catch (error) {
            throw new Error(`Failed to install dependencies: ${error.message}`);
        }
    }

    /**
     * Ensure PlantUML jar is available
     */
    async ensurePlantUML() {
        console.log('☕ Checking PlantUML...');

        const plantUMLPath = path.join(__dirname, '..', 'tools', 'plantuml.jar');
        
        if (!fs.existsSync(plantUMLPath)) {
            console.log('⬇️  Downloading PlantUML...');
            try {
                await execAsync('npm run download-plantuml');
            } catch (error) {
                throw new Error(`Failed to download PlantUML: ${error.message}`);
            }
        }

        console.log('✅ PlantUML ready');
    }

    /**
     * Build executables for all platforms
     */
    async buildExecutables() {
        console.log('🔨 Building executables...');

        // Build all targets with pkg
        const targets = Object.values(this.platforms).map(p => p.target).join(',');
        
        try {
            console.log('   Building for all platforms...');
            await execAsync(`npx pkg . --targets ${targets} --out-path ${this.distDir}`);
            console.log('✅ Executables built');
        } catch (error) {
            throw new Error(`Failed to build executables: ${error.message}`);
        }
    }

    /**
     * Create distribution packages for each platform
     */
    async createDistributions() {
        console.log('📦 Creating distribution packages...');

        for (const [platformKey, platform] of Object.entries(this.platforms)) {
            await this.createPlatformDistribution(platformKey, platform);
        }

        console.log('✅ Distribution packages created');
    }

    /**
     * Create distribution for a specific platform
     */
    async createPlatformDistribution(platformKey, platform) {
        console.log(`   📱 Packaging ${platform.name}...`);

        const executablePath = path.join(this.distDir, platform.executable);
        if (!fs.existsSync(executablePath)) {
            console.log(`   ⚠️  Executable not found for ${platform.name}, skipping...`);
            return;
        }

        // Create platform-specific directory
        const platformDir = path.join(this.distDir, platformKey);
        await this.ensureDir(platformDir);

        // Copy executable
        const targetExecutable = path.join(platformDir, platform.launcher);
        fs.copyFileSync(executablePath, targetExecutable);

        // Make executable on Unix platforms
        if (platformKey !== 'win-x64') {
            fs.chmodSync(targetExecutable, 0o755);
        }

        // Copy essential files
        await this.copyEssentialFiles(platformDir);

        // Create platform-specific scripts
        await this.createPlatformScripts(platformDir, platformKey, platform);

        // Create README
        await this.createPlatformReadme(platformDir, platformKey, platform);

        // Create archive
        await this.createArchive(platformDir, platform.archiveName, platformKey);
    }

    /**
     * Copy essential files that are needed at runtime
     */
    async copyEssentialFiles(targetDir) {
        const filesToCopy = [
            'README.md',
            'requirements.md',
            'design.md',
            'tools/plantuml.jar'
        ];

        for (const file of filesToCopy) {
            const sourcePath = path.join(__dirname, '..', file);
            if (fs.existsSync(sourcePath)) {
                const targetPath = path.join(targetDir, path.basename(file));
                
                if (file.includes('/')) {
                    // Ensure directory exists for nested files
                    const dir = path.dirname(path.join(targetDir, file));
                    await this.ensureDir(dir);
                    fs.copyFileSync(sourcePath, path.join(targetDir, file));
                } else {
                    fs.copyFileSync(sourcePath, targetPath);
                }
            }
        }

        // Ensure tools directory exists
        const toolsDir = path.join(targetDir, 'tools');
        await this.ensureDir(toolsDir);
        
        // Copy plantuml.jar specifically
        const plantUMLSource = path.join(__dirname, '..', 'tools', 'plantuml.jar');
        const plantUMLTarget = path.join(toolsDir, 'plantuml.jar');
        if (fs.existsSync(plantUMLSource)) {
            fs.copyFileSync(plantUMLSource, plantUMLTarget);
        }
    }

    /**
     * Create platform-specific launcher scripts
     */
    async createPlatformScripts(targetDir, platformKey, platform) {
        if (platformKey === 'win-x64') {
            // Windows batch file
            const batchContent = `@echo off
echo.
echo MarkViewer ${this.version}
echo =================
echo.
echo Starting MarkViewer...
echo Press Ctrl+C to stop
echo.
"%~dp0${platform.launcher}" %*
`;
            fs.writeFileSync(path.join(targetDir, 'start.bat'), batchContent);

        } else {
            // Unix shell script
            const shellContent = `#!/bin/bash

echo ""
echo "MarkViewer ${this.version}"
echo "================="
echo ""
echo "Starting MarkViewer..."
echo "Press Ctrl+C to stop"
echo ""

# Get the directory where this script is located
DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$DIR"

# Launch the application
./${platform.launcher} "$@"
`;
            const startScript = path.join(targetDir, 'start.sh');
            fs.writeFileSync(startScript, shellContent);
            fs.chmodSync(startScript, 0o755);
        }
    }

    /**
     * Create platform-specific README
     */
    async createPlatformReadme(targetDir, platformKey, platform) {
        const readmeContent = `# MarkViewer ${this.version} - ${platform.name}

## Quick Start

### 1. Launch MarkViewer
${platformKey === 'win-x64' ? 
`- **Double-click**: \`start.bat\`
- **Command line**: \`${platform.launcher}\`` :
`- **Double-click**: \`start.sh\`
- **Command line**: \`./${platform.launcher}\``}

### 2. Use the Application
1. The application will automatically open in your browser
2. Click "Select Workspace Directory" 
3. Enter the path to your markdown files
4. Start browsing and searching!

## System Requirements

- **Operating System**: ${this.getOSRequirement(platformKey)}
- **Memory**: 512MB RAM minimum, 1GB recommended
- **Java Runtime**: Required for PlantUML diagram rendering (optional)

## Command Line Options

- \`--no-browser\` - Disable automatic browser opening
- \`--port <number>\` - Specify custom port (default: auto-detect)
- \`--help\` - Show help information

## Features

- ✅ Standalone executable (no Node.js installation required)
- ✅ PlantUML diagram rendering (included plantuml.jar)
- ✅ Mermaid diagram support
- ✅ Syntax highlighting for code blocks
- ✅ Real-time file watching
- ✅ Powerful search functionality
- ✅ Responsive design

## Troubleshooting

### Application won't start
- Check if port 3001 is available
- Try running with \`--port 8080\` to use a different port
- Ensure you have sufficient permissions to run executables

### PlantUML diagrams not rendering
- Install Java Runtime Environment (JRE) from oracle.com/java
- Ensure \`java\` command is available in your PATH

### Browser doesn't open automatically
- Manually open: http://localhost:3001 (or the port shown in terminal)
- Use \`--no-browser\` option and open manually

## Support

For documentation and support, visit the project repository.

---
**MarkViewer ${this.version}** - Built with ❤️ for seamless markdown viewing
`;

        fs.writeFileSync(path.join(targetDir, 'README.txt'), readmeContent);
    }

    /**
     * Get OS requirement string for platform
     */
    getOSRequirement(platformKey) {
        switch (platformKey) {
            case 'win-x64': return 'Windows 10 or later (64-bit)';
            case 'macos-x64': return 'macOS 10.14 or later (Intel Mac)';
            case 'macos-arm64': return 'macOS 11.0 or later (Apple Silicon Mac)';
            case 'linux-x64': return 'Linux (64-bit) with glibc 2.17+';
            default: return 'Compatible system';
        }
    }

    /**
     * Create archive for platform
     */
    async createArchive(sourceDir, archiveName, platformKey) {
        const archivePath = path.join(this.releaseDir, archiveName);

        if (platformKey === 'linux-x64') {
            // Create tar.gz for Linux
            await execAsync(`tar -czf "${archivePath}" -C "${path.dirname(sourceDir)}" "${path.basename(sourceDir)}"`);
        } else {
            // Create zip for Windows and macOS
            await this.createZip(sourceDir, archivePath);
        }
    }

    /**
     * Create ZIP archive
     */
    createZip(sourceDir, targetPath) {
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(targetPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', resolve);
            archive.on('error', reject);

            archive.pipe(output);
            archive.directory(sourceDir, path.basename(sourceDir, path.extname(sourceDir)));
            archive.finalize();
        });
    }

    /**
     * Cleanup temporary files
     */
    async cleanup() {
        console.log('🧹 Cleaning up...');
        
        // Remove individual executables (keep only packaged versions)
        const files = fs.readdirSync(this.distDir);
        for (const file of files) {
            const filePath = path.join(this.distDir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isFile() && (file.endsWith('.exe') || (!file.includes('.') && file !== 'package.json'))) {
                fs.unlinkSync(filePath);
            }
        }

        console.log('✅ Cleanup complete');
    }

    /**
     * Show packaging results
     */
    showResults() {
        console.log('');
        console.log('📊 Packaging Results');
        console.log('==================');
        console.log('');

        const archives = fs.readdirSync(this.releaseDir)
            .filter(file => file.startsWith(this.appName) && 
                (file.endsWith('.zip') || file.endsWith('.tar.gz')))
            .sort();

        for (const archive of archives) {
            const archivePath = path.join(this.releaseDir, archive);
            const stats = fs.statSync(archivePath);
            const sizeInMB = (stats.size / 1024 / 1024).toFixed(1);
            
            console.log(`✅ ${archive} (${sizeInMB} MB)`);
        }

        console.log('');
        console.log('🚀 Ready for distribution!');
        console.log('');
        console.log('Distribution files location:');
        console.log(`   ${this.releaseDir}`);
        console.log('');
    }

    /**
     * Ensure directory exists
     */
    async ensureDir(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }
}

// Run the packager
if (require.main === module) {
    const packager = new ExecutablePackager();
    packager.package().catch(console.error);
}

module.exports = ExecutablePackager;
