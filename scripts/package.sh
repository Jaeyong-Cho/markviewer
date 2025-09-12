#!/bin/bash

# MarkViewer Packaging Script
# Creates a distributable package of MarkViewer application
# Usage: ./package.sh [version]
#   version - Optional version number (defaults to package.json version)

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [version]"
    echo ""
    echo "Arguments:"
    echo "  version    Optional version number (e.g., 1.2.0)"
    echo "             If not provided, uses version from package.json"
    echo ""
    echo "Examples:"
    echo "  $0                # Use version from package.json"
    echo "  $0 1.2.0          # Use specific version 1.2.0"
    echo "  $0 1.2.0-beta.1   # Use pre-release version"
    exit 1
}

# Check for help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_usage
fi

echo "📦 MarkViewer Packaging Script"
echo "==============================="
echo ""

# Configuration
PACKAGE_NAME="markviewer"

# Determine version
if [ -n "$1" ]; then
    VERSION="$1"
    echo "🏷️  Using specified version: $VERSION"
    
    # Basic version validation (semantic versioning pattern)
    if ! echo "$VERSION" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$' > /dev/null; then
        warning "Version '$VERSION' doesn't follow semantic versioning format (e.g., 1.2.3, 1.2.3-beta.1)"
        echo "   Continuing anyway..."
    fi
else
    VERSION=$(node -p "require('./package.json').version")
    echo "🏷️  Using package.json version: $VERSION"
fi

RELEASE_DIR="release"
PACKAGE_DIR="${RELEASE_DIR}/${PACKAGE_NAME}-${VERSION}"
CURRENT_DIR=$(pwd)

# Function to check if command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        error "$1 is required but not installed"
    fi
}

# Verify requirements
info "Checking requirements..."
check_command "node"
check_command "npm"
check_command "zip"
check_command "tar"

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 14 ]; then
    error "Node.js v14+ is required (found v$NODE_VERSION)"
fi

success "Requirements verified"

# Clean previous builds
info "Cleaning previous builds..."
rm -rf "$RELEASE_DIR"
mkdir -p "$PACKAGE_DIR"

# Create directory structure
info "Creating package structure..."
mkdir -p "$PACKAGE_DIR"/{backend,frontend,tools,scripts,docs}

# Copy main files
info "Copying main files..."
cp package.json "$PACKAGE_DIR/"
cp README.md "$PACKAGE_DIR/"
cp start.js "$PACKAGE_DIR/"
cp requirements.md "$PACKAGE_DIR/"
cp design.md "$PACKAGE_DIR/"

# Copy and install backend
info "Preparing backend..."
cp -r backend/package.json "$PACKAGE_DIR/backend/"
cp -r backend/server.js "$PACKAGE_DIR/backend/"
cp -r backend/services "$PACKAGE_DIR/backend/"
cp -r backend/utils "$PACKAGE_DIR/backend/"

# Install backend dependencies
info "Installing backend dependencies..."
cd "$PACKAGE_DIR/backend"
npm install --production --silent
cd "$CURRENT_DIR"

# Copy and install frontend
info "Preparing frontend..."
cp -r frontend/package.json "$PACKAGE_DIR/frontend/"
cp -r frontend/index.html "$PACKAGE_DIR/frontend/"
cp -r frontend/js "$PACKAGE_DIR/frontend/"
cp -r frontend/styles "$PACKAGE_DIR/frontend/"
cp -r frontend/libs "$PACKAGE_DIR/frontend/"

# Install frontend dependencies
info "Installing frontend dependencies..."
cd "$PACKAGE_DIR/frontend"
npm install --production --silent
cd "$CURRENT_DIR"

# Copy tools and scripts
info "Copying tools and scripts..."
cp -r tools "$PACKAGE_DIR/"
cp -r scripts/dev-server.py "$PACKAGE_DIR/scripts/"
cp -r docs "$PACKAGE_DIR/"

# Verify PlantUML
if [ ! -f "tools/plantuml.jar" ]; then
    warning "PlantUML jar not found, downloading..."
    node scripts/download-plantuml.js
    cp tools/plantuml.jar "$PACKAGE_DIR/tools/"
fi

# Create installation scripts
info "Creating installation scripts..."

# Unix installation script
cat > "$PACKAGE_DIR/install.sh" << 'EOF'
#!/bin/bash

echo "🚀 MarkViewer Installation"
echo "=========================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "   Please install Node.js v14+ from https://nodejs.org/"
    exit 1
fi

# Check Java (for PlantUML)
if ! command -v java &> /dev/null; then
    echo "⚠️  Java is not installed"
    echo "   PlantUML diagrams will not work without Java"
    echo "   Install Java from https://www.oracle.com/java/technologies/javase-downloads.html"
fi

# Make start script executable
chmod +x start.js

echo "✅ Installation complete!"
echo ""
echo "To start MarkViewer:"
echo "  ./start.js"
echo ""
echo "Or with no auto-browser:"
echo "  ./start.js --no-browser"
echo ""
EOF

# Windows installation script
cat > "$PACKAGE_DIR/install.bat" << 'EOF'
@echo off
echo.
echo MarkViewer Installation
echo =======================
echo.

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed
    echo    Please install Node.js v14+ from https://nodejs.org/
    pause
    exit /b 1
)

REM Check Java (for PlantUML)
java -version >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Java is not installed
    echo    PlantUML diagrams will not work without Java
    echo    Install Java from https://www.oracle.com/java/technologies/javase-downloads.html
)

echo ✅ Installation complete!
echo.
echo To start MarkViewer:
echo   node start.js
echo.
echo Or with no auto-browser:
echo   node start.js --no-browser
echo.
pause
EOF

# Make scripts executable
chmod +x "$PACKAGE_DIR/install.sh"
chmod +x "$PACKAGE_DIR/start.js"

# Create launcher scripts
info "Creating launcher scripts..."

# Unix launcher
cat > "$PACKAGE_DIR/markviewer" << 'EOF'
#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$DIR"
./start.js "$@"
EOF

# Windows launcher
cat > "$PACKAGE_DIR/markviewer.bat" << 'EOF'
@echo off
cd /d "%~dp0"
node start.js %*
EOF

chmod +x "$PACKAGE_DIR/markviewer"

# Create README for package
info "Creating package README..."
cat > "$PACKAGE_DIR/PACKAGE_README.md" << 'EOF'
# MarkViewer - Packaged Distribution

## Quick Start

### 1. Install (First time only)
- **Unix/Linux/macOS**: Run `./install.sh`
- **Windows**: Run `install.bat`

### 2. Launch MarkViewer
- **Simple**: `./markviewer` (Unix) or `markviewer.bat` (Windows)
- **Manual**: `./start.js` (Unix) or `node start.js` (Windows)

### 3. Use the Application
1. The application will automatically open in your browser
2. Click "Select Workspace Directory" 
3. Enter the path to your markdown files
4. Start browsing and searching!

## Command Line Options

- `--no-browser` - Disable automatic browser opening
- `--test` - Test mode (starts and immediately shuts down)

## Requirements

- **Node.js v14+** - Required for running the application
- **Java Runtime** - Required for PlantUML diagram rendering
- **Modern Browser** - Chrome, Firefox, Safari, or Edge

## Troubleshooting

If you encounter issues:

1. **Port conflicts**: The application will automatically find available ports
2. **Permissions**: Make sure scripts are executable (`chmod +x start.js markviewer`)
3. **Dependencies**: Run the install script again if dependencies are missing
4. **Browser issues**: Try manually opening `http://localhost:3001`

## Manual Browser Access

If auto-browser opening fails, manually open:
- `http://localhost:3001` (or the port shown in terminal output)

## Support

For issues and documentation, visit the project repository.
EOF

# Create distribution archives
info "Creating distribution archives..."

cd "$RELEASE_DIR"

# Create ZIP archive (cross-platform)
zip -r "${PACKAGE_NAME}-${VERSION}.zip" "${PACKAGE_NAME}-${VERSION}" > /dev/null
success "Created ${PACKAGE_NAME}-${VERSION}.zip"

# Create TAR.GZ archive (Unix/Linux preferred)
tar -czf "${PACKAGE_NAME}-${VERSION}.tar.gz" "${PACKAGE_NAME}-${VERSION}"
success "Created ${PACKAGE_NAME}-${VERSION}.tar.gz"

cd "$CURRENT_DIR"

# Test the package
info "Testing package..."
cd "$PACKAGE_DIR"
./start.js --test --no-browser
cd "$CURRENT_DIR"

# Display results
echo ""
success "Packaging completed successfully!"
echo ""
echo "📦 Package Details:"
echo "   Name: $PACKAGE_NAME"
echo "   Version: $VERSION"
echo "   Location: $RELEASE_DIR/"
echo ""
echo "📋 Distribution Files:"
echo "   • ${PACKAGE_NAME}-${VERSION}.zip (Cross-platform)"
echo "   • ${PACKAGE_NAME}-${VERSION}.tar.gz (Unix/Linux)"
echo ""
echo "🚀 To test the package:"
echo "   cd $PACKAGE_DIR"
echo "   ./start.js"
echo ""

# Calculate sizes
ZIP_SIZE=$(ls -lh "$RELEASE_DIR/${PACKAGE_NAME}-${VERSION}.zip" | awk '{print $5}')
TAR_SIZE=$(ls -lh "$RELEASE_DIR/${PACKAGE_NAME}-${VERSION}.tar.gz" | awk '{print $5}')

echo "📊 Package Sizes:"
echo "   ZIP: $ZIP_SIZE"
echo "   TAR.GZ: $TAR_SIZE"
echo ""

success "Ready for distribution! 🎉"
