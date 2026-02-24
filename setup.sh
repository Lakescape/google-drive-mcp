#!/bin/bash

# Google Drive Cowork - Setup Script
# Combines Open Claude Cowork + Google Drive MCP setup

set -e

echo ""
echo "=================================================="
echo "  Google Drive Cowork - Setup"
echo "=================================================="
echo ""
echo "This will set up:"
echo "  1. Composio (500+ app integrations)"
echo "  2. Anthropic API key (Claude Agent SDK)"
echo "  3. Google Drive MCP (Drive, Docs, Sheets, Slides)"
echo ""

# ============================================================
# Step 1: Composio Setup
# ============================================================
echo "Step 1: Composio Setup"
echo "----------------------"

# Check if Composio CLI is installed
if ! command -v composio &> /dev/null; then
    echo "Composio CLI not found. Installing..."
    echo ""
    curl -fsSL https://composio.dev/install | bash
    echo ""
    echo "Composio CLI installed successfully!"
    echo ""
    # Source the shell config to make composio available immediately
    if [ -f "$HOME/.bashrc" ]; then
        source "$HOME/.bashrc"
    elif [ -f "$HOME/.zshrc" ]; then
        source "$HOME/.zshrc"
    fi
else
    echo "Composio CLI already installed"
    echo ""
fi

# Check if user is already logged in
if composio whoami &> /dev/null; then
    echo "Already logged in to Composio"
    echo ""
else
    echo "Please log in to Composio (or sign up if you don't have an account)"
    echo "This will open your browser to complete authentication"
    echo ""
    read -p "Press Enter to continue..."
    composio login
    echo ""
    echo "Successfully authenticated with Composio!"
    echo ""
fi

# ============================================================
# Step 2: API Keys
# ============================================================
echo "Step 2: API Key Configuration"
echo "-----------------------------"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo ".env file created"
    echo ""
else
    echo ".env file already exists"
    echo ""
fi

# Prompt for Anthropic API key
echo "You'll need an Anthropic API key from: https://console.anthropic.com"
echo ""
read -p "Enter your Anthropic API key (or press Enter to skip): " anthropic_key

if [ ! -z "$anthropic_key" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=$anthropic_key/" .env
    else
        sed -i "s/ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=$anthropic_key/" .env
    fi
    echo "Anthropic API key saved to .env"
else
    echo "Skipped Anthropic API key. Please add it to .env manually."
fi
echo ""

# Get Composio API key and update .env
echo "Retrieving Composio API key..."
composio_key=$(composio whoami 2>&1 | grep -o "API Key: .*" | cut -d ' ' -f 3 || echo "")

if [ ! -z "$composio_key" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/COMPOSIO_API_KEY=.*/COMPOSIO_API_KEY=$composio_key/" .env
    else
        sed -i "s/COMPOSIO_API_KEY=.*/COMPOSIO_API_KEY=$composio_key/" .env
    fi
    echo "Composio API key saved to .env"
else
    echo "Could not retrieve Composio API key automatically."
    echo "Please add it to .env manually."
fi
echo ""

# ============================================================
# Step 3: Google Drive MCP Setup
# ============================================================
echo "Step 3: Google Drive MCP Setup"
echo "------------------------------"
echo ""
echo "Google Drive integration gives Claude access to 38 tools:"
echo "  - Drive: search, list, create, delete, move files/folders"
echo "  - Docs:  create, edit, format Google Documents"
echo "  - Sheets: create, edit, format, conditional formatting"
echo "  - Slides: create, edit, format, add shapes/text boxes"
echo ""

read -p "Do you want to set up Google Drive integration? (y/n): " setup_gdrive

if [ "$setup_gdrive" = "y" ] || [ "$setup_gdrive" = "Y" ]; then
    echo ""

    # Check for OAuth credentials
    if [ -f "gcp-oauth.keys.json" ]; then
        echo "Google OAuth credentials found (gcp-oauth.keys.json)"
    else
        echo "Google OAuth credentials not found."
        echo ""
        echo "To set up Google Drive, you need to:"
        echo "  1. Go to https://console.cloud.google.com"
        echo "  2. Create a project (or select existing)"
        echo "  3. Enable these APIs:"
        echo "     - Google Drive API"
        echo "     - Google Docs API"
        echo "     - Google Sheets API"
        echo "     - Google Slides API"
        echo "  4. Create OAuth 2.0 credentials (Desktop application)"
        echo "  5. Download the JSON and save it as 'gcp-oauth.keys.json' in this directory"
        echo ""
        echo "See gcp-oauth.keys.example.json for the expected format."
        echo ""
        read -p "Press Enter after placing gcp-oauth.keys.json, or press Enter to skip..."

        if [ ! -f "gcp-oauth.keys.json" ]; then
            echo "gcp-oauth.keys.json not found. Skipping Google Drive setup."
            echo "You can set this up later by placing the file and running: npm run auth"
            echo ""
        fi
    fi

    # Build the MCP server
    if [ -f "gcp-oauth.keys.json" ]; then
        echo ""
        echo "Building Google Drive MCP server..."
        npm run build:mcp 2>/dev/null || {
            echo "Build failed. Installing dependencies first..."
            npm install
            npm run build:mcp
        }
        echo "MCP server built successfully."
        echo ""

        # Run authentication
        echo "Now let's authenticate with Google Drive."
        echo "This will open your browser for Google OAuth consent."
        echo ""
        read -p "Press Enter to start authentication..."
        npm run auth
        echo ""
        echo "Google Drive authentication complete!"
    fi
else
    echo "Skipping Google Drive setup. You can set it up later with:"
    echo "  1. Place gcp-oauth.keys.json in project root"
    echo "  2. Run: npm run build:mcp"
    echo "  3. Run: npm run auth"
fi
echo ""

# ============================================================
# Step 4: Install Dependencies
# ============================================================
echo "Step 4: Installing Dependencies"
echo "-------------------------------"
echo ""
npm install
cd server && npm install && cd ..
echo ""
echo "Dependencies installed"
echo ""

# ============================================================
# Done
# ============================================================
echo "=================================================="
echo "  Setup Complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "  1. Start the backend server:"
echo "     cd server && npm start"
echo ""
echo "  2. In a new terminal, start the Electron app:"
echo "     npm start"
echo ""

# Show Google Drive status
if [ -f "gcp-oauth.keys.json" ] && [ -f "dist/index.js" ]; then
    echo "  Google Drive: ENABLED (38 tools)"
else
    echo "  Google Drive: DISABLED"
    echo "  To enable later: place gcp-oauth.keys.json, then run:"
    echo "    npm run build:mcp && npm run auth"
fi

echo ""
echo "For more info:"
echo "  - Composio Dashboard: https://platform.composio.dev"
echo "  - Google Cloud Console: https://console.cloud.google.com"
echo "  - Claude Agent SDK: https://docs.anthropic.com/en/docs/claude-agent-sdk"
echo ""
