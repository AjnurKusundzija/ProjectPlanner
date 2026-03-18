"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.static(path_1.default.resolve('frontend')));
const mcpClient = new index_js_1.Client({
    name: 'PlannerAI-Frontend-Bridge',
    version: '1.0.0',
});
const isWin = process.platform === 'win32';
const transport = new stdio_js_1.StdioClientTransport({
    command: isWin ? 'npx.cmd' : 'npx',
    args: ['tsx', 'src/server.ts'],
    stderr: 'inherit',
});
async function startBridge() {
    console.log('Connecting to MCP server via Stdio...');
    await mcpClient.connect(transport);
    console.log('Connected to MCP server!');
    app.get('/api/health', (_req, res) => {
        res.json({ ok: true });
    });
    app.get('/api/tools', async (_req, res) => {
        try {
            const tools = await mcpClient.listTools();
            res.json(tools);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            console.error('Error listing tools:', message);
            res.status(500).json({ error: message });
        }
    });
    app.post('/api/tools/execute', async (req, res) => {
        try {
            const { name, args } = req.body;
            const result = await mcpClient.callTool({ name: String(name ?? ''), arguments: args ?? {} });
            res.json(result);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            console.error('Error executing tool:', message);
            res.status(500).json({ error: message });
        }
    });
    app.get('/api/prompts', async (_req, res) => {
        try {
            const prompts = await mcpClient.listPrompts();
            res.json(prompts);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            console.error('Error listing prompts:', message);
            res.status(500).json({ error: message });
        }
    });
    app.post('/api/prompts/execute', async (req, res) => {
        try {
            const { name, args } = req.body;
            const result = await mcpClient.getPrompt({ name: String(name ?? ''), arguments: args ?? {} });
            res.json(result);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            console.error('Error executing prompt:', message);
            res.status(500).json({ error: message });
        }
    });
    app.get(/.*/, (_req, res) => {
        res.sendFile(path_1.default.resolve('frontend/index.html'));
    });
    const port = Number(process.env.PORT || 3000);
    app.listen(port, () => {
        console.log(`Bridge Express server running on http://localhost:${port}`);
        console.log(`Open http://localhost:${port}/index.html to view the PlannerAI frontend`);
    });
}
startBridge().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Bridge startup failed:', message);
    process.exit(1);
});
