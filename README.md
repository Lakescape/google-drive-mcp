# Google Drive Cowork

An open-source Claude Cowork desktop app with **native Google Drive integration**. Combines the [Open Claude Cowork](https://github.com/ComposioHQ/open-claude-cowork) Electron chat interface with a built-in [Google Drive MCP](https://github.com/piotr-agier/google-drive-mcp) server, giving Claude direct access to **38 Google Workspace tools** plus **500+ app integrations** via Composio.

## What You Get

- **Desktop Chat App** - Electron-based AI chat with streaming responses, tool visualization, multi-chat sessions
- **Multi-Provider Support** - Claude Agent SDK and Opencode SDK with model selection
- **38 Google Drive Tools** - Native Drive, Docs, Sheets, and Slides operations via MCP
- **500+ App Integrations** - Composio Tool Router for connecting to any SaaS app
- **Session Persistence** - Chat history saved locally, session resumption across restarts

## Google Drive Tools (38 total)

### Drive Management (8 tools)
`search` `listFolder` `createFolder` `createTextFile` `updateTextFile` `deleteItem` `renameItem` `moveItem`

### Google Docs (5 tools)
`createGoogleDoc` `updateGoogleDoc` `getGoogleDocContent` `formatGoogleDocText` `formatGoogleDocParagraph`

### Google Sheets (9 tools)
`createGoogleSheet` `updateGoogleSheet` `getGoogleSheetContent` `formatGoogleSheetCells` `formatGoogleSheetText` `formatGoogleSheetNumbers` `setGoogleSheetBorders` `mergeGoogleSheetCells` `addGoogleSheetConditionalFormat`

### Google Slides (9 tools)
`createGoogleSlides` `updateGoogleSlides` `getGoogleSlidesContent` `formatGoogleSlidesText` `formatGoogleSlidesParagraph` `styleGoogleSlidesShape` `setGoogleSlidesBackground` `createGoogleSlidesTextBox` `createGoogleSlidesShape`

Plus standard Claude Code tools: `Read` `Write` `Edit` `Bash` `Glob` `Grep` `WebSearch` `WebFetch` `TodoWrite` `Skill`

## Quick Start

### 1. Run Setup
```bash
bash setup.sh
```

This will guide you through:
- Composio CLI installation and authentication
- Anthropic API key configuration
- Google Drive OAuth setup (optional)

### 2. Start the Backend
```bash
cd server && npm start
```

### 3. Start the Electron App
```bash
# In a new terminal
npm start
```

## Manual Setup

### Prerequisites
- Node.js 18+
- npm

### Install Dependencies
```bash
npm install
cd server && npm install && cd ..
```

### Configure API Keys

Create a `.env` file from the template:
```bash
cp .env.example .env
```

Edit `.env` with your keys:
```
ANTHROPIC_API_KEY=your-key-here
COMPOSIO_API_KEY=your-key-here
```

### Set Up Google Drive (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project and enable these APIs:
   - Google Drive API
   - Google Docs API
   - Google Sheets API
   - Google Slides API
3. Create OAuth 2.0 credentials (Desktop application type)
4. Download the JSON and save as `gcp-oauth.keys.json` in the project root
5. Build and authenticate:
```bash
npm run build:mcp
npm run auth
```

## Architecture

```
google-drive-cowork/
├── main.js              # Electron main process
├── preload.js           # Secure IPC bridge
├── renderer/            # Frontend UI
│   ├── index.html       # Chat interface
│   ├── style.css        # Styles
│   └── renderer.js      # Chat logic, streaming, tool visualization
├── server/              # Backend (Express + AI SDKs)
│   ├── server.js        # API server with Google Drive MCP integration
│   └── providers/       # AI provider abstraction
│       ├── base-provider.js
│       ├── claude-provider.js
│       └── opencode-provider.js
├── src/                 # Google Drive MCP server (TypeScript)
│   ├── index.ts         # MCP server with 38 tools
│   └── auth/            # OAuth2 authentication
├── dist/                # Compiled MCP server (built)
├── setup.sh             # Interactive setup script
└── package.json
```

### How It Works

1. **Electron App** sends messages to the Express backend (port 3001)
2. **Backend** routes to the selected AI provider (Claude or Opencode)
3. **Claude Agent SDK** connects to MCP servers:
   - **Google Drive MCP** (stdio) - 38 tools for Drive/Docs/Sheets/Slides
   - **Composio MCP** (HTTP) - 500+ app integrations
4. **Streaming SSE** pipes tool calls and responses back to the UI

## Scripts

| Command | Description |
|---------|-------------|
| `npm run setup` | Run interactive setup |
| `npm start` | Launch Electron app |
| `npm run start:server` | Start backend server only |
| `npm run build:mcp` | Build Google Drive MCP server |
| `npm run auth` | Authenticate with Google Drive |
| `npm run start:mcp` | Run MCP server standalone |
| `npm run dev` | Development mode with hot reload |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `COMPOSIO_API_KEY` | Yes | Composio API key for tool integrations |
| `GOOGLE_DRIVE_OAUTH_CREDENTIALS` | No | Custom path to OAuth credentials |
| `GOOGLE_DRIVE_MCP_TOKEN_PATH` | No | Custom path to auth tokens |
| `PORT` | No | Backend server port (default: 3001) |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Stream chat with AI agent |
| `/api/abort` | POST | Stop active query |
| `/api/providers` | GET | List available AI providers |
| `/api/health` | GET | Health check with Google Drive status |
| `/api/gdrive/status` | GET | Detailed Google Drive integration status |

## Credits

- [Open Claude Cowork](https://github.com/ComposioHQ/open-claude-cowork) by ComposioHQ
- [Google Drive MCP](https://github.com/piotr-agier/google-drive-mcp) by Piotr Agier
- [Claude Agent SDK](https://docs.anthropic.com/en/docs/claude-agent-sdk) by Anthropic
- [Composio](https://composio.dev) for 500+ app integrations

## License

MIT
