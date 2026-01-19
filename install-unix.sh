#!/bin/bash

echo ""
echo "========================================"
echo "  Rapunzel Installer for Unix"
echo "  \"Let down your hair extensions!\""
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} Node.js is not installed or not in PATH."
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}[OK]${NC} Node.js found: $(node --version)"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NATIVE_APP_DIR="${SCRIPT_DIR}/native-app"
EXTENSION_DIR="${SCRIPT_DIR}/extension"

# Check if native-app directory exists
if [ ! -d "$NATIVE_APP_DIR" ]; then
    echo -e "${RED}[ERROR]${NC} native-app directory not found"
    exit 1
fi

echo -e "${GREEN}[OK]${NC} Found native-app directory"

# Install npm dependencies
echo ""
echo "Installing dependencies..."
cd "$NATIVE_APP_DIR"
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR]${NC} Failed to install npm dependencies"
    exit 1
fi

echo -e "${GREEN}[OK]${NC} Dependencies installed"

# Make scripts executable
chmod +x index.js
chmod +x install.js

# Run the install script
echo ""
echo "Registering native messaging host..."
node install.js install

if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR]${NC} Failed to register native messaging host"
    exit 1
fi

echo ""
echo "========================================"
echo "  Installation Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Open Firefox"
echo "2. Go to about:debugging#/runtime/this-firefox"
echo "3. Click 'Load Temporary Add-on'"
echo "4. Select the manifest.json file in:"
echo "   ${EXTENSION_DIR}"
echo ""
echo "Or install the extension from addons.mozilla.org"
echo "once it's published."
echo ""
echo "After installing the extension:"
echo "- Click the Rapunzel icon in the toolbar"
echo "- Configure your extensions folder"
echo "- Click 'Let Down Your Hair!'"
echo ""
