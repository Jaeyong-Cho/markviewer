# MarkViewer Packaging Guide

This guide explains how to create distribution packages for MarkViewer that can be downloaded and run immediately on Windows, macOS, and Linux.

## Package Types

MarkViewer supports two types of distribution packages:

### 1. Traditional Packages (Node.js Required)
- **Requires**: Node.js v14+ to be installed on target system
- **Includes**: Source code, dependencies, and plantuml.jar
- **Formats**: ZIP (cross-platform), TAR.GZ (Unix/Linux preferred)
- **Size**: Smaller (~10-20MB)

### 2. Standalone Executables (No Dependencies)
- **Requires**: Nothing (fully self-contained)
- **Includes**: Embedded Node.js runtime, all dependencies, and plantuml.jar
- **Formats**: Platform-specific executables
- **Size**: Larger (~50-80MB per platform)

## Quick Start

### For Developers (Building Packages)

```bash
# Complete setup and build all packages
npm run build-all

# Or on Windows
npm run build-all-win
```

This single command will:
1. Install all dependencies
2. Download PlantUML
3. Test the application
4. Create traditional packages
5. Create standalone executables

### For End Users (Using Packages)

1. **Download** any package from the releases
2. **Extract** the package
3. **Install** by running:
   - Unix/Linux/macOS: `./install.sh`
   - Windows: `install.bat`
4. **Launch** the application:
   - Unix/Linux/macOS: `./markviewer` or `./start.sh`
   - Windows: `markviewer.bat` or `start.bat`

## Manual Packaging

### Traditional Packages Only
```bash
npm run package
```

### Standalone Executables Only
```bash
npm run package-executables
```

### Both Types
```bash
npm run package-all
```

## Package Contents

### Traditional Packages Include:
- `start.js` - Main application launcher
- `backend/` - Backend server and API
- `frontend/` - Web interface
- `tools/plantuml.jar` - PlantUML for diagram rendering
- `install.sh` / `install.bat` - Installation scripts
- `markviewer` / `markviewer.bat` - Launcher scripts
- `README.md` and documentation

### Standalone Executables Include:
- `markviewer` / `markviewer.exe` - Standalone executable
- `tools/plantuml.jar` - PlantUML for diagram rendering
- `start.sh` / `start.bat` - Easy launcher scripts
- `README.txt` - Platform-specific documentation

## Supported Platforms

| Platform | Traditional Package | Standalone Executable |
|----------|-------------------|----------------------|
| Windows x64 | ✅ ZIP | ✅ EXE |
| macOS Intel | ✅ ZIP/TAR.GZ | ✅ Binary |
| macOS Apple Silicon | ✅ ZIP/TAR.GZ | ✅ Binary |
| Linux x64 | ✅ TAR.GZ | ✅ Binary |

## System Requirements

### Traditional Packages
- **Node.js**: v14.0.0 or higher
- **Java**: JRE 8+ (optional, for PlantUML diagrams)
- **Memory**: 512MB RAM minimum
- **Storage**: 100MB free space

### Standalone Executables
- **Java**: JRE 8+ (optional, for PlantUML diagrams)
- **Memory**: 512MB RAM minimum
- **Storage**: 200MB free space
- **No Node.js required** ✨

## Command Line Options

All packages support these options:

- `--no-browser` - Don't open browser automatically
- `--port <number>` - Use specific port (default: 3001)
- `--test` - Test mode (start and immediately shutdown)
- `--help` - Show help information

Examples:
```bash
# Start without opening browser
./markviewer --no-browser

# Use custom port
./markviewer --port 8080

# Combine options
./markviewer --no-browser --port 3000
```

## Architecture

### Traditional Package Flow
```
User runs start.js
├── Checks Node.js availability
├── Installs dependencies if needed
├── Starts backend server (separate process)
├── Starts frontend server (if needed)
└── Opens browser automatically
```

### Standalone Executable Flow
```
User runs executable
├── Embedded Node.js runtime
├── Bundled dependencies
├── Starts backend server (in-process)
├── Serves frontend from embedded assets
└── Opens browser automatically
```

## Troubleshooting

### Build Issues

**"pkg not found"**
```bash
npm install  # Make sure pkg is installed
```

**"PlantUML not downloaded"**
```bash
npm run download-plantuml
```

**"Node.js version too old"**
- Update to Node.js v14+ from nodejs.org

### Runtime Issues

**"Port already in use"**
- Use `--port` option to specify different port
- Application will auto-detect available ports

**"Browser doesn't open"**
- Use `--no-browser` and open http://localhost:3001 manually
- Check firewall settings

**"PlantUML diagrams not rendering"**
- Install Java Runtime Environment
- Verify `java` command is in PATH

## Development

### File Structure
```
scripts/
├── build-all.sh          # Complete build script (Unix)
├── build-all.bat         # Complete build script (Windows)
├── package.sh            # Traditional packaging
├── package-executables.js # Standalone executable packaging
└── download-plantuml.js   # PlantUML downloader

package.json              # Includes pkg configuration
start.js                  # Enhanced launcher with package detection
```

### Adding New Platforms

1. Add target to `package.json` pkg.targets
2. Update platform configurations in `package-executables.js`
3. Test on target platform

### Customizing Packages

Edit `scripts/package-executables.js` to:
- Change executable names
- Modify included files
- Add custom installation scripts
- Adjust platform-specific behaviors

## Best Practices

### For Distributors
- Always test packages on clean systems
- Include clear installation instructions
- Provide checksums for security
- Document system requirements

### For End Users
- Download from official sources only
- Verify checksums if provided
- Run installation scripts as recommended
- Check system requirements before installing

## Support

For issues with packaging or distribution:
1. Check this documentation
2. Verify system requirements
3. Test with `npm run test-package`
4. Create an issue with build logs

---

**MarkViewer** - Making markdown viewing accessible everywhere! 🚀
