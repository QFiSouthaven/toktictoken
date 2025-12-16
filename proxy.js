
import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import bodyParser from 'body-parser';
import { spawn } from 'child_process';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ESM scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PROXY_PORT = 1234;      // Port your App connects to (Browser -> Proxy)
// ARCHITECTURE FIX: Use 127.0.0.1 explicitly to avoid Node.js DNS/Ambiguity issues with 'localhost'
const DEFAULT_UPSTREAM = "http://127.0.0.1:1235"; 
const WORKSPACE_DIR = path.join(__dirname, 'workspace');

// Initialize Workspace
if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR);
}

// Mutable Upstream Target
let upstreamUrl = DEFAULT_UPSTREAM;

const CONTEXT_FILE = path.join(__dirname, 'SWARM_CONTEXT.md');

const INITIAL_CONTEXT_TEMPLATE = `# Local Swarm Context (Shared Brain)

> **SYSTEM ALERT**: This file is the synchronization point between the Swarm Intelligence (Web UI) and the Implementation Engine (Claude Code CLI).

## Instructions for the Reader (Claude / Developer)
1. **You are the Lead Engineer.** The Swarm (Orchestrator, Analyst, Critic) generates plans and writes them here.
2. **Your Goal:** Implement the code described in the "FINAL SWARM PLAN" section below.
3. **Communication:** If you need clarification, use the Bridge to send a message back to the Swarm.

**Recommended Tooling:**
- **Editor:** Open this folder in [Cursor](https://cursor.com) for AI-native code editing.
- **CLI:** Use \`claude\` to execute the plan autonomously.

---
## Session Log
(Waiting for Swarm Input...)
`;

// SECURITY: Dynamic Origin Allowlist
// This allows the developer to access the app via localhost OR local network IPs
const isAllowedOrigin = (origin) => {
    if (!origin) return true; // Mobile/Curl
    try {
        const url = new URL(origin);
        const hostname = url.hostname;
        
        // Standard loopback
        if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
        
        // LAN / Private Network IPs (Fixes CORS for 172.x, 192.168.x, 10.x)
        if (hostname.startsWith('10.')) return true;
        if (hostname.startsWith('192.168.')) return true;
        if (hostname.startsWith('172.')) return true; // Covers Docker/WSL2 ranges (172.16-31)
        
        return false;
    } catch(e) { return false; }
};

// SECURITY: Command Allowlist
const ALLOWED_COMMANDS = [
  'npm', 'node', 'git', 'python', 'pip', 'python3', 'pip3',
  'echo', 'cd', 'ls', 'dir', 'mkdir', 'rm', 'rmdir', 'del',
  'cls', 'clear', 'nvm', 'choco', 'winget', 'pwd', 'whoami',
  'tsc', 'vite', 'cursor', 'code'
];

// BRIDGE MEMORY
let pendingInput = null;    // Message from CLI waiting for App
let latestOutput = null;    // Message from App waiting for CLI

// --- MONGODB SETUP ---
let isDbConnected = false;

// 1. Define Schemas
const MessageSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  agentId: String, // Null for user
  content: String,
  timestamp: Number,
  sources: [{ title: String, uri: String }],
  toolCalls: Array, // Allow storing tool calls
  usage: {
    promptTokens: Number,
    responseTokens: Number,
    totalTokens: Number
  },
  cost: Number
});

const AgentSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  name: String,
  role: String,
  systemInstruction: String,
  avatar: String,
  color: String,
  model: String
});

// New Schema for Learning/Version Control
const VersionHistorySchema = new mongoose.Schema({
  tags: [String],
  action: String,
  outcome: String, // 'success' | 'failure'
  errorDetails: String,
  timestamp: Number
});

const MessageModel = mongoose.model('Message', MessageSchema);
const AgentModel = mongoose.model('Agent', AgentSchema);
const VersionHistoryModel = mongoose.model('VersionHistory', VersionHistorySchema);

// 2. Connect
mongoose.connect('mongodb://127.0.0.1:27017/local-swarm')
  .then(() => {
    console.log('[MONGODB] Connected Successfully');
    isDbConnected = true;
  })
  .catch(err => {
    console.warn('[MONGODB] Warning: Could not connect to MongoDB. Running in ephemeral mode.');
    isDbConnected = false;
  });


// 1. Handle PNA Preflight (The crucial fix for "unknown address space" error)
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(204);
});

// 2. Global Middleware for PNA
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  next();
});

// Hardened CORS Policy with Dynamic Origin
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    console.warn(`[CORS] Blocked request from: ${origin}`);
    return callback(null, false);
  },
  credentials: true
}));

// Increase limit for large Code/SoT payloads
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// --- HELPER: CONTEXT SYNC ---
const updateContextFile = (message, source) => {
    try {
        const timestamp = new Date().toLocaleString();
        const header = `\n\n--- ${source.toUpperCase()} MESSAGE [${timestamp}] ---\n`;
        const sender = message.agentId ? `**Agent (${message.agentId})**` : "**User**";
        const entry = `${header}${sender}: ${message.content}\n`;
        
        fs.appendFileSync(CONTEXT_FILE, entry);
    } catch (e) {
        console.error(`[FILE SYNC ERROR] Could not write to context file: ${e.message}`);
    }
};

// Initialize Context File if not exists
if (!fs.existsSync(CONTEXT_FILE)) {
    fs.writeFileSync(CONTEXT_FILE, INITIAL_CONTEXT_TEMPLATE);
    console.log('[FILESYSTEM] Initialized SWARM_CONTEXT.md');
}

// --- CONFIGURATION ENDPOINT (Dynamic Router) ---
app.post('/config/upstream', (req, res) => {
    const { url } = req.body;
    if (url) {
        // Basic validation
        try {
            const newUrl = new URL(url);
            upstreamUrl = newUrl.toString().replace(/\/$/, ''); // Remove trailing slash
            console.log(`[PROXY] Upstream target updated to: ${upstreamUrl}`);
            res.json({ success: true, target: upstreamUrl });
        } catch (e) {
            res.status(400).json({ error: "Invalid URL format" });
        }
    } else {
        res.status(400).json({ error: "Missing url in body" });
    }
});


// --- DATABASE ENDPOINTS ---

app.get('/db/status', (req, res) => {
  res.json({ connected: isDbConnected });
});

// Messages CRUD
app.get('/db/messages', async (req, res) => {
  if (!isDbConnected) return res.json({ messages: [] });
  try {
    const messages = await MessageModel.find().sort({ timestamp: 1 });
    res.json({ messages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/db/messages', async (req, res) => {
  if (!isDbConnected) return res.status(503).json({ error: 'DB Disconnected' });
  try {
    const { message } = req.body;
    // Update if exists (upsert), otherwise insert
    await MessageModel.findOneAndUpdate(
      { id: message.id },
      message,
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/db/messages', async (req, res) => {
  if (!isDbConnected) return res.status(503).json({ error: 'DB Disconnected' });
  try {
    await MessageModel.deleteMany({});
    // Also clear the context file
    fs.writeFileSync(CONTEXT_FILE, INITIAL_CONTEXT_TEMPLATE);
    console.log('[MONGODB] Chat history cleared.');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Agents CRUD
app.get('/db/agents', async (req, res) => {
  if (!isDbConnected) return res.json({ agents: [] });
  try {
    const agents = await AgentModel.find();
    res.json({ agents });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/db/agents', async (req, res) => {
  if (!isDbConnected) return res.status(503).json({ error: 'DB Disconnected' });
  try {
    const { agent } = req.body;
    await AgentModel.findOneAndUpdate(
      { id: agent.id },
      agent,
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/db/agents/:id', async (req, res) => {
  if (!isDbConnected) return res.status(503).json({ error: 'DB Disconnected' });
  try {
    const { id } = req.params;
    await AgentModel.deleteOne({ id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- VERSION CONTROL / MEMORY ENDPOINTS ---

// Log a learning entry
app.post('/db/memory/log', async (req, res) => {
  if (!isDbConnected) return res.status(503).json({ error: 'DB Disconnected' });
  try {
    const { tags, action, outcome, errorDetails } = req.body;
    const entry = new VersionHistoryModel({
      tags: tags || [],
      action,
      outcome,
      errorDetails,
      timestamp: Date.now()
    });
    await entry.save();
    console.log(`[LEARNING] Logged: ${action} -> ${outcome}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Check for lessons learned
app.post('/db/memory/query', async (req, res) => {
  if (!isDbConnected) return res.json({ lessons: [] });
  try {
    const { tags } = req.body; // Array of keywords
    if (!tags || tags.length === 0) return res.json({ lessons: [] });
    
    // Find logs that failed matching any of the tags
    const failures = await VersionHistoryModel.find({
      tags: { $in: tags },
      outcome: 'failure'
    }).sort({ timestamp: -1 }).limit(5);

    res.json({ lessons: failures });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// --- FILE SYSTEM ENDPOINTS (Workspace Sandbox) ---

// 1. Write File (Secured to Workspace)
app.post('/files/write', (req, res) => {
    const { filename, content } = req.body;
    
    if (!filename || !content) {
        return res.status(400).json({ error: "Missing filename or content" });
    }

    // SANITIZATION: Prevent directory traversal
    const safeFilename = path.normalize(filename).replace(/^(\.\.[\/\\])+/, '');
    const targetPath = path.join(WORKSPACE_DIR, safeFilename);
    
    // Ensure target is still within workspace
    if (!targetPath.startsWith(WORKSPACE_DIR)) {
        return res.status(403).json({ error: "Access Denied: Path traversal detected." });
    }

    try {
        fs.writeFileSync(targetPath, content, 'utf-8');
        console.log(`[FILES] Written to ${safeFilename}`);
        res.json({ success: true, path: safeFilename });
    } catch (e) {
        res.status(500).json({ error: `Write failed: ${e.message}` });
    }
});

// 2. Download File
app.get('/files/download', (req, res) => {
    const { filename } = req.query;
    if (!filename) return res.status(400).send("Missing filename");

    const safeFilename = path.normalize(filename.toString()).replace(/^(\.\.[\/\\])+/, '');
    const targetPath = path.join(WORKSPACE_DIR, safeFilename);

    if (!targetPath.startsWith(WORKSPACE_DIR)) {
        return res.status(403).send("Access Denied");
    }

    if (fs.existsSync(targetPath)) {
        res.download(targetPath, safeFilename, (err) => {
            if (err) console.error("Download error:", err);
        });
    } else {
        res.status(404).send("File not found in workspace");
    }
});

// Secure endpoint to read the context file
app.get('/files/read', (req, res) => {
    const { path: filePath } = req.query;
    const ALLOWED_FILES = ['SWARM_CONTEXT.md'];
    
    // Also allow reading from workspace
    const isWorkspaceFile = filePath && !filePath.includes('..') && fs.existsSync(path.join(WORKSPACE_DIR, filePath));

    if ((!filePath || !ALLOWED_FILES.includes(filePath)) && !isWorkspaceFile) {
        return res.status(403).json({ error: "Access Denied." });
    }
    
    const targetPath = isWorkspaceFile ? path.join(WORKSPACE_DIR, filePath) : path.join(__dirname, filePath);
    
    if (fs.existsSync(targetPath)) {
        try {
            const content = fs.readFileSync(targetPath, 'utf-8');
            res.json({ content });
        } catch (e) {
            res.status(500).json({ error: `Read Error: ${e.message}` });
        }
    } else {
        res.status(404).json({ error: "File not found" });
    }
});


// --- TERMINAL EXECUTION ENDPOINT ---
app.post('/terminal/exec', (req, res) => {
  const { command, cwd } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'No command provided' });
  }

  const trimmed = command.trim();
  const rootCommand = trimmed.split(' ')[0];

  if (!ALLOWED_COMMANDS.includes(rootCommand)) {
      console.warn(`[SECURITY BLOCK] Attempted restricted command: ${rootCommand}`);
      res.status(403).send(`Security Error: Command '${rootCommand}' is not in the allowlist.`);
      return;
  }

  if (/[;&|]/.test(trimmed)) {
      console.warn(`[SECURITY BLOCK] Attempted command chaining: ${trimmed}`);
      res.status(403).send(`Security Error: Command chaining operators (&&, ;, |) are disabled.`);
      return;
  }

  console.log(`[TERMINAL] Executing: ${command}`);

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Transfer-Encoding', 'chunked');

  const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
  const child = spawn(command, [], {
    shell: true,
    cwd: cwd || process.cwd(),
    env: process.env
  });

  child.stdout.on('data', (data) => {
    res.write(data);
  });

  child.stderr.on('data', (data) => {
    res.write(data);
  });

  child.on('error', (error) => {
    res.write(`\nError starting process: ${error.message}\n`);
    res.end();
  });

  child.on('close', (code) => {
    res.write(`\nProcess exited with code ${code}\n`);
    res.end();
  });
});

// --- BRIDGE ENDPOINTS (CLI <-> APP) ---

app.post('/bridge/cli/input', (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: "No content provided" });
  
  console.log(`[BRIDGE] Incoming from CLI: "${content.substring(0, 50)}..."`);
  
  const msgObj = {
    id: Date.now().toString(),
    content,
    timestamp: Date.now()
  };
  
  pendingInput = msgObj;
  updateContextFile(msgObj, 'CLI');

  res.json({ success: true, status: "Message queued for Swarm" });
});

app.get('/bridge/cli/output', (req, res) => {
  res.json({ message: latestOutput });
});

app.get('/bridge/app/input', (req, res) => {
  if (pendingInput) {
    console.log(`[BRIDGE] App picked up message: ${pendingInput.id}`);
    res.json({ message: pendingInput });
    pendingInput = null;
  } else {
    res.json({ message: null });
  }
});

app.post('/bridge/app/output', (req, res) => {
  const { message } = req.body;
  if (message) {
    console.log(`[BRIDGE] Outgoing from Swarm: "${message.content.substring(0, 50)}..."`);
    latestOutput = message;
    updateContextFile(message, 'SWARM');
  }
  res.json({ success: true });
});

// --- LM STUDIO PROXY (Dynamic) ---

const apiProxy = createProxyMiddleware({
  target: DEFAULT_UPSTREAM, // Fallback if router fails
  router: () => upstreamUrl, // Dynamic Routing function
  changeOrigin: true,
  pathRewrite: {
    // Keep paths as is
  },
  onProxyRes: (proxyRes, req, res) => {
    // Dynamic Origin handling for PNA
    const origin = req.headers.origin;
    if (isAllowedOrigin(origin)) {
        proxyRes.headers['Access-Control-Allow-Origin'] = origin;
    }
    proxyRes.headers['Access-Control-Allow-Private-Network'] = 'true';
    proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
  },
  onError: (err, req, res) => {
      console.error(`[PROXY ERROR] Target: ${upstreamUrl} | Message: ${err.message}`);
      res.status(502).json({ error: 'Bad Gateway', details: 'Could not reach upstream LM Studio.', target: upstreamUrl });
  }
});

app.use('/v1', apiProxy);

app.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`\n=== LOCAL SWARM BRIDGE ACTIVE ===`);
  console.log(`1. Bridge/Proxy:         http://localhost:${PROXY_PORT}`);
  console.log(`2. Database API:         http://localhost:${PROXY_PORT}/db/status`);
  console.log(`3. Memory System:        http://localhost:${PROXY_PORT}/db/memory`);
  console.log(`4. Workspace Sandbox:    ${WORKSPACE_DIR}`);
  console.log(`5. LM Studio Target:     ${upstreamUrl} (Dynamic)`);
  console.log(`================================\n`);
});
