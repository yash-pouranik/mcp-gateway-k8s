import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { requireUserAuth, requireAdmin } from '../middleware/auth.js';
import { encryptCredential } from '../services/crypto.js';
import { validateServerUrl } from '../services/ssrf.js';
import { upstreamManager } from '../mcp/upstream.js';
import { updateUpstreamStatusMetric } from '../services/metrics.js';

const router = Router();

// GET /api/servers (List all registered servers with their exposed tools)
router.get('/', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const servers = await prisma.mcpServer.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      url: true,
      credentialHeader: true,
      enabled: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  let aggregatedTools: any[] = [];
  try {
    aggregatedTools = await upstreamManager.aggregateTools();
  } catch (_) {
    // Non-fatal if aggregation fails
  }

  const enrichedServers = servers.map((s) => {
    const sTools = aggregatedTools.filter((t) => t.serverId === s.id || t.serverSlug === s.slug);
    return {
      ...s,
      tools: sTools.map((t) => ({
        originalName: t.originalName,
        gatewayName: t.gatewayName,
        description: t.description,
      })),
      toolCount: sTools.length,
    };
  });

  res.json({ servers: enrichedServers });
});

// POST /api/servers (Register new upstream server - Admin only)
router.post('/', requireUserAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { name, slug, url, credentialHeader, credentialValue } = req.body;

  if (!name || !slug || !url) {
    res.status(400).json({ error: 'Name, slug, and url are required' });
    return;
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug)) {
    res.status(400).json({ error: 'Slug must contain only lowercase letters, numbers, and hyphens' });
    return;
  }

  // Validate URL with SSRF protection
  try {
    await validateServerUrl(url);
  } catch (err: any) {
    res.status(400).json({ error: `URL validation failed: ${err.message}` });
    return;
  }

  // Check unique slug
  const existing = await prisma.mcpServer.findUnique({ where: { slug } });
  if (existing) {
    res.status(409).json({ error: `Server with slug "${slug}" already exists` });
    return;
  }

  let encryptedCredential: string | null = null;
  if (credentialValue && typeof credentialValue === 'string') {
    encryptedCredential = encryptCredential(credentialValue);
  }

  const server = await prisma.mcpServer.create({
    data: {
      name,
      slug,
      url,
      credentialHeader: credentialHeader || 'Authorization',
      credentialValueEncrypted: encryptedCredential,
      enabled: true,
      status: 'connected',
    },
    select: {
      id: true,
      name: true,
      slug: true,
      url: true,
      credentialHeader: true,
      enabled: true,
      status: true,
      createdAt: true,
    },
  });

  updateUpstreamStatusMetric(server.slug, 'connected');
  upstreamManager.invalidateCache();
  res.status(201).json({ server });
});

// PATCH /api/servers/:id/toggle (Enable/Disable server - Admin only)
router.patch('/:id/toggle', requireUserAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const server = await prisma.mcpServer.findUnique({ where: { id } });

  if (!server) {
    res.status(404).json({ error: 'Server not found' });
    return;
  }

  const updatedEnabled = !server.enabled;
  const updatedStatus = updatedEnabled ? 'connected' : 'disabled';

  const updated = await prisma.mcpServer.update({
    where: { id },
    data: {
      enabled: updatedEnabled,
      status: updatedStatus,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      url: true,
      credentialHeader: true,
      enabled: true,
      status: true,
      createdAt: true,
    },
  });

  updateUpstreamStatusMetric(updated.slug, updatedStatus);
  upstreamManager.invalidateCache();
  res.json({ server: updated });
});

// DELETE /api/servers/:id (Delete server - Admin only)
router.delete('/:id', requireUserAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const server = await prisma.mcpServer.findUnique({ where: { id } });

  if (!server) {
    res.status(404).json({ error: 'Server not found' });
    return;
  }

  await prisma.mcpServer.delete({ where: { id } });
  updateUpstreamStatusMetric(server.slug, 'disabled');

  upstreamManager.invalidateCache();
  res.json({ message: 'Server deleted successfully' });
});

// GET /api/servers/:id/tools (Inspect tools of a specific server)
router.get('/:id/tools', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const server = await prisma.mcpServer.findUnique({ where: { id } });

  if (!server) {
    res.status(404).json({ error: 'Server not found' });
    return;
  }

  try {
    const tools = await upstreamManager.listServerTools(server);
    res.json({ tools });
  } catch (err: any) {
    res.status(502).json({ error: `Could not fetch tools from upstream server: ${err.message}` });
  }
});

// PUT /api/servers/:id (Update server configuration - Admin only)
router.put('/:id', requireUserAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const server = await prisma.mcpServer.findUnique({ where: { id } });

  if (!server) {
    res.status(404).json({ error: 'Server not found' });
    return;
  }

  const { name, url, credentialHeader, credentialValue } = req.body;

  if (url) {
    try {
      await validateServerUrl(url);
    } catch (err: any) {
      res.status(400).json({ error: `URL validation failed: ${err.message}` });
      return;
    }
  }

  const updateData: any = {};
  if (name) updateData.name = name;
  if (url) updateData.url = url;
  if (credentialHeader !== undefined) updateData.credentialHeader = credentialHeader;
  if (credentialValue && typeof credentialValue === 'string') {
    updateData.credentialValueEncrypted = encryptCredential(credentialValue);
  }

  const updated = await prisma.mcpServer.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      slug: true,
      url: true,
      credentialHeader: true,
      enabled: true,
      status: true,
      createdAt: true,
    },
  });

  upstreamManager.invalidateCache();
  res.json({ server: updated });
});

export default router;
