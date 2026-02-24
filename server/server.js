import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { getProvider, getAvailableProviders, initializeProviders } from './providers/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Composio (optional - works without it if only using Google Drive)
let composio = null;
let composioAvailable = false;
try {
  const { Composio: ComposioClass } = await import('@composio/core');
  if (process.env.COMPOSIO_API_KEY) {
    composio = new ComposioClass();
    composioAvailable = true;
  } else {
    console.log('[COMPOSIO] No COMPOSIO_API_KEY set - Composio integrations disabled');
    console.log('[COMPOSIO] Google Drive MCP tools will still work if configured');
  }
} catch (err) {
  console.log('[COMPOSIO] Composio SDK not available:', err.message);
}

const composioSessions = new Map();
let defaultComposioSession = null;

// ============================================================
// Google Drive MCP Integration
// ============================================================

// Resolve the path to the compiled Google Drive MCP server
const GDRIVE_MCP_PATH = path.join(__dirname, '..', 'dist', 'index.js');
let googleDriveEnabled = false;

// Check if Google Drive MCP is built and auth tokens exist
function checkGoogleDriveReady() {
  // Check if the MCP server binary exists
  if (!fs.existsSync(GDRIVE_MCP_PATH)) {
    console.log('[GDRIVE] MCP server not built yet. Run "npm run build:mcp" first.');
    return false;
  }

  // Check for OAuth credentials
  const keysPath = path.join(__dirname, '..', 'gcp-oauth.keys.json');
  const hasCredentials = fs.existsSync(keysPath);

  // Check for auth tokens (XDG path or legacy)
  const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || '', '.config');
  const tokenPath = process.env.GOOGLE_DRIVE_MCP_TOKEN_PATH || path.join(xdgConfig, 'google-drive-mcp', 'tokens.json');
  const hasTokens = fs.existsSync(tokenPath);

  if (!hasCredentials) {
    console.log('[GDRIVE] OAuth credentials not found at gcp-oauth.keys.json');
    console.log('[GDRIVE] To enable Google Drive: copy gcp-oauth.keys.example.json to gcp-oauth.keys.json with your Google Cloud credentials.');
    return false;
  }

  if (!hasTokens) {
    console.log('[GDRIVE] Auth tokens not found. Run "npm run auth" to authenticate with Google Drive.');
    return false;
  }

  console.log('[GDRIVE] Google Drive MCP is ready - 38 tools available (Drive, Docs, Sheets, Slides)');
  return true;
}

// Build the Google Drive MCP server config for Claude Agent SDK
function getGoogleDriveMcpConfig() {
  if (!googleDriveEnabled) return {};

  const env = {};

  // Pass through relevant env vars
  if (process.env.GOOGLE_DRIVE_OAUTH_CREDENTIALS) {
    env.GOOGLE_DRIVE_OAUTH_CREDENTIALS = process.env.GOOGLE_DRIVE_OAUTH_CREDENTIALS;
  }
  if (process.env.GOOGLE_DRIVE_MCP_TOKEN_PATH) {
    env.GOOGLE_DRIVE_MCP_TOKEN_PATH = process.env.GOOGLE_DRIVE_MCP_TOKEN_PATH;
  }

  return {
    'google-drive': {
      type: 'stdio',
      command: 'node',
      args: [GDRIVE_MCP_PATH],
      env
    }
  };
}

// ============================================================

// Pre-initialize Composio session on startup
async function initializeComposioSession() {
  if (!composioAvailable) {
    console.log('[COMPOSIO] Skipped - Composio not configured');
    // Still write opencode.json with Google Drive config if available
    updateOpencodeConfig(null, null);
    return;
  }

  const defaultUserId = 'default-user';
  console.log('[COMPOSIO] Pre-initializing session for:', defaultUserId);
  try {
    defaultComposioSession = await composio.create(defaultUserId);
    composioSessions.set(defaultUserId, defaultComposioSession);
    console.log('[COMPOSIO] Session ready with MCP URL:', defaultComposioSession.mcp.url);

    // Update opencode.json with all MCP configs
    updateOpencodeConfig(defaultComposioSession.mcp.url, defaultComposioSession.mcp.headers);
    console.log('[OPENCODE] Updated opencode.json with MCP config');
  } catch (error) {
    console.error('[COMPOSIO] Failed to pre-initialize session:', error.message);
    // Still write Google Drive config even if Composio fails
    updateOpencodeConfig(null, null);
  }
}

// Write MCP config to opencode.json (includes both Composio and Google Drive)
function updateOpencodeConfig(mcpUrl, mcpHeaders) {
  const opencodeConfigPath = path.join(__dirname, 'opencode.json');
  const mcpConfig = {};

  // Add Composio if available
  if (mcpUrl && mcpHeaders) {
    mcpConfig.composio = {
      type: 'remote',
      url: mcpUrl,
      headers: mcpHeaders
    };
  }

  // Add Google Drive MCP if enabled
  if (googleDriveEnabled) {
    mcpConfig['google-drive'] = {
      type: 'local',
      command: 'node',
      args: [GDRIVE_MCP_PATH]
    };
  }

  const config = { mcp: mcpConfig };
  fs.writeFileSync(opencodeConfigPath, JSON.stringify(config, null, 2));
}

// Middleware
app.use(cors());
app.use(express.json());

// Chat endpoint using provider abstraction
app.post('/api/chat', async (req, res) => {
  const {
    message,
    chatId,
    userId = 'default-user',
    provider: providerName = 'claude',  // Per-request provider selection
    model = null  // Per-request model selection
  } = req.body;

  console.log('[CHAT] Request received:', message);
  console.log('[CHAT] Chat ID:', chatId);
  console.log('[CHAT] Provider:', providerName);
  console.log('[CHAT] Model:', model || '(default)');

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Validate provider
  const availableProviders = getAvailableProviders();
  if (!availableProviders.includes(providerName.toLowerCase())) {
    return res.status(400).json({
      error: `Invalid provider: ${providerName}. Available: ${availableProviders.join(', ')}`
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Processing request...' })}\n\n`);

  const heartbeatInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': heartbeat\n\n');
    }
  }, 15000);

  res.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  try {
    // Build MCP servers config
    const mcpServers = {};

    // Add Composio if available
    if (composioAvailable) {
      let composioSession = composioSessions.get(userId);
      if (!composioSession) {
        console.log('[COMPOSIO] Creating new session for user:', userId);
        res.write(`data: ${JSON.stringify({ type: 'status', message: 'Initializing session...' })}\n\n`);
        composioSession = await composio.create(userId);
        composioSessions.set(userId, composioSession);
        console.log('[COMPOSIO] Session created with MCP URL:', composioSession.mcp.url);

        // Update opencode.json with the MCP config
        updateOpencodeConfig(composioSession.mcp.url, composioSession.mcp.headers);
        console.log('[OPENCODE] Updated opencode.json with MCP config');
      }
      mcpServers.composio = {
        type: 'http',
        url: composioSession.mcp.url,
        headers: composioSession.mcp.headers
      };
    }

    // Merge in Google Drive MCP if available
    Object.assign(mcpServers, getGoogleDriveMcpConfig());

    // Get the provider instance
    const provider = getProvider(providerName);

    console.log('[CHAT] Using provider:', provider.name);
    console.log('[CHAT] MCP servers:', Object.keys(mcpServers).join(', '));
    console.log('[CHAT] Google Drive:', googleDriveEnabled ? 'enabled' : 'disabled');
    console.log('[CHAT] All stored sessions:', Array.from(provider.sessions.entries()));

    // Stream responses from the provider
    try {
      for await (const chunk of provider.query({
        prompt: message,
        chatId,
        userId,
        mcpServers,
        model,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'TodoWrite', 'Skill'],
        maxTurns: 100
      })) {
        if (chunk.type === 'tool_use') {
          console.log('[SSE] Sending tool_use:', chunk.name);
        }
        if (chunk.type === 'text') {
          console.log('[SSE] Sending text chunk, length:', chunk.content?.length || 0);
        }
        // Send chunk as SSE
        const data = `data: ${JSON.stringify(chunk)}\n\n`;
        res.write(data);
      }
    } catch (streamError) {
      console.error('[CHAT] Stream error during iteration:', streamError);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: streamError.message })}\n\n`);
      }
    }

    clearInterval(heartbeatInterval);
    if (!res.writableEnded) {
      res.end();
    }
    console.log('[CHAT] Stream completed');
  } catch (error) {
    clearInterval(heartbeatInterval);
    console.error('[CHAT] Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

// Abort endpoint to stop active queries
app.post('/api/abort', (req, res) => {
  const { chatId, provider: providerName = 'claude' } = req.body;

  if (!chatId) {
    return res.status(400).json({ error: 'chatId is required' });
  }

  console.log('[ABORT] Request to abort chatId:', chatId, 'provider:', providerName);

  try {
    const provider = getProvider(providerName);
    const aborted = provider.abort(chatId);

    if (aborted) {
      console.log('[ABORT] Successfully aborted chatId:', chatId);
      res.json({ success: true, message: 'Query aborted' });
    } else {
      console.log('[ABORT] No active query found for chatId:', chatId);
      res.json({ success: false, message: 'No active query to abort' });
    }
  } catch (error) {
    console.error('[ABORT] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available providers endpoint
app.get('/api/providers', (_req, res) => {
  res.json({
    providers: getAvailableProviders(),
    default: 'claude'
  });
});

// Health check endpoint with Google Drive status
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    providers: getAvailableProviders(),
    googleDrive: {
      enabled: googleDriveEnabled,
      tools: googleDriveEnabled ? 38 : 0,
      capabilities: googleDriveEnabled
        ? ['Drive files', 'Google Docs', 'Google Sheets', 'Google Slides']
        : []
    }
  });
});

// Google Drive status endpoint
app.get('/api/gdrive/status', (_req, res) => {
  const keysPath = path.join(__dirname, '..', 'gcp-oauth.keys.json');
  const hasCredentials = fs.existsSync(keysPath);
  const hasMcpBuild = fs.existsSync(GDRIVE_MCP_PATH);

  const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || '', '.config');
  const tokenPath = process.env.GOOGLE_DRIVE_MCP_TOKEN_PATH || path.join(xdgConfig, 'google-drive-mcp', 'tokens.json');
  const hasTokens = fs.existsSync(tokenPath);

  res.json({
    enabled: googleDriveEnabled,
    mcpBuilt: hasMcpBuild,
    credentialsFound: hasCredentials,
    authenticated: hasTokens,
    toolCount: googleDriveEnabled ? 38 : 0,
    tools: googleDriveEnabled ? {
      drive: ['search', 'listFolder', 'createFolder', 'createTextFile', 'updateTextFile', 'deleteItem', 'renameItem', 'moveItem'],
      docs: ['createGoogleDoc', 'updateGoogleDoc', 'getGoogleDocContent', 'formatGoogleDocText', 'formatGoogleDocParagraph'],
      sheets: ['createGoogleSheet', 'updateGoogleSheet', 'getGoogleSheetContent', 'formatGoogleSheetCells', 'formatGoogleSheetText', 'formatGoogleSheetNumbers', 'setGoogleSheetBorders', 'mergeGoogleSheetCells', 'addGoogleSheetConditionalFormat'],
      slides: ['createGoogleSlides', 'updateGoogleSlides', 'getGoogleSlidesContent', 'formatGoogleSlidesText', 'formatGoogleSlidesParagraph', 'styleGoogleSlidesShape', 'setGoogleSlidesBackground', 'createGoogleSlidesTextBox', 'createGoogleSlidesShape']
    } : {}
  });
});

await initializeProviders();

// Check Google Drive readiness before Composio (opencode config needs this)
googleDriveEnabled = checkGoogleDriveReady();

await initializeComposioSession();

// Start server and keep reference to prevent garbage collection
const server = app.listen(PORT, () => {
  console.log(`\n===================================================`);
  console.log(`  Google Drive Cowork - Backend Server`);
  console.log(`===================================================`);
  console.log(`  Server:     http://localhost:${PORT}`);
  console.log(`  Chat:       POST http://localhost:${PORT}/api/chat`);
  console.log(`  Providers:  GET  http://localhost:${PORT}/api/providers`);
  console.log(`  Health:     GET  http://localhost:${PORT}/api/health`);
  console.log(`  GDrive:     GET  http://localhost:${PORT}/api/gdrive/status`);
  console.log(`  Providers:  ${getAvailableProviders().join(', ')}`);
  console.log(`  Composio:   ${composioAvailable ? 'ENABLED (500+ app integrations)' : 'DISABLED (no API key)'}`);
  console.log(`  Google Drive: ${googleDriveEnabled ? 'ENABLED (38 tools)' : 'DISABLED'}`);
  console.log(`===================================================\n`);
});

// Keep the process alive
server.on('error', (err) => {
  console.error('Server error:', err);
});

// Prevent the process from exiting
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
