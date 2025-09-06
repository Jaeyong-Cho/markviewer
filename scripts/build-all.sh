#!/bin/bash

# MarkViewer Complete Setup and Packaging Script
# Sets up development environment and creates all distribution packages

set -e  # Exit on any error

echo "🚀 MarkViewer Complete Setup and Packaging"
echo "==========================================="
echo ""

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

# Check if command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        error "$1 is required but not installed"
    fi
}

# Verify requirements
info "Checking system requirements..."
check_command "node"
check_command "npm"

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 14 ]; then
    error "Node.js v14+ is required (found v$NODE_VERSION)"
fi

success "System requirements verified"

# Clean previous builds
info "Cleaning previous builds..."
npm run clean 2>/dev/null || true

# Install main dependencies
info "Installing main dependencies..."
npm install

# Download PlantUML if needed
info "Setting up PlantUML..."
npm run download-plantuml

# Install sub-project dependencies
info "Installing all project dependencies..."
npm run install-all

# Test the application
info "Testing application startup..."
npm run test-package

success "Application test completed"

# Create traditional packages (zip/tar.gz)
info "Creating traditional distribution packages..."
npm run package

# Create executable packages
info "Creating standalone executable packages..."
npm run package-executables

# Display results
echo ""
success "🎉 Complete packaging finished!"
echo ""
echo "📦 Available distributions:"
echo ""

if [ -d "release" ]; then
    ls -la release/ | grep -E "\.(zip|tar\.gz)$" | while read -r line; do
        filename=$(echo $line | awk '{print $9}')
        size=$(echo $line | awk '{print $5}')
        echo "   ✅ $filename ($size bytes)"
    done
fi

echo ""
echo "🚀 Quick start for end users:"
echo "   1. Download and extract any package"
echo "   2. Run the installer (install.sh or install.bat)"
echo "   3. Launch with ./markviewer (Unix) or markviewer.bat (Windows)"
echo ""
echo "📁 Distribution files location: ./release/"
echo ""

success "Ready for distribution! 🎉"
