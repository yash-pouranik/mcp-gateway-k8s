import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import serversRoutes from './routes/servers.js';
import membersRoutes from './routes/members.js';
import auditRoutes from './routes/audit.js';
import chatRoutes from './routes/chat.js';
import { authenticateMcpClient } from './middleware/auth.js';
import { handleMcpRequest } from './mcp/server.js';
import { startHealthMonitor } from './services/healthMonitor.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'mcp-gateway', timestamp: new Date().toISOString() });
});

// REST API routes for Dashboard
app.use('/api/auth', authRoutes);
app.use('/api/servers', serversRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/chat', chatRoutes);

// Streamable HTTP MCP Endpoint (supports API Key and JWT)
app.all('/mcp', authenticateMcpClient, (req, res) => {
  handleMcpRequest(req, res).catch((err) => {
    console.error('Unhandled error in MCP transport handler:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal MCP Gateway error' });
    }
  });
});

app.listen(PORT, () => {
  console.log(`MCP Gateway running on port ${PORT}`);
  startHealthMonitor(30000);
});
