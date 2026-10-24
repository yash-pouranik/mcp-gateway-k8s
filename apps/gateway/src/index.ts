import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import serversRoutes from './routes/servers.js';
import membersRoutes from './routes/members.js';
import auditRoutes from './routes/audit.js';
import chatRoutes from './routes/chat.js';
import metricsRoutes from './routes/metrics.js';
import oauthRoutes from './routes/oauth.js';
import { authenticateMcpClient } from './middleware/auth.js';
import { handleMcpRequest } from './mcp/server.js';
import { startHealthMonitor } from './services/healthMonitor.js';
import { register } from './services/metrics.js';

const app = express();
const PORT = process.env.PORT || 3000;
const METRICS_TOKEN = process.env.METRICS_TOKEN || process.env.JWT_SECRET || 'mcp_gateway_prometheus_scrape_secret';

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get(['/health', '/api/health'], (_req, res) => {
  res.json({ status: 'healthy', service: 'mcp-gateway', timestamp: new Date().toISOString() });
});

// Prometheus Scrape Endpoint (Protected from unauthorized public access)
app.get('/metrics', async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  const isInternal = req.ip === '127.0.0.1' || req.ip === '::1' || req.headers['x-internal-scrape'] === 'true';
  const isAuthorized = authHeader === `Bearer ${METRICS_TOKEN}` || authHeader === `Bearer ${process.env.JWT_SECRET}`;

  if (!isInternal && !isAuthorized) {
    res.status(403).json({
      error: 'Forbidden: /metrics is restricted to internal cluster scrapers or authorized Bearer credentials',
    });
    return;
  }

  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});

// REST API routes for Dashboard
app.use('/api/auth', authRoutes);
app.use('/api/servers', serversRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/metrics', metricsRoutes);

// OAuth 2.0 Authorization Server routes (PUBLIC - before auth middleware)
app.use(oauthRoutes);

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
