import express, { Request, Response, NextFunction } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';

const PORT = process.env.PORT || 3000;
const MCP_AUTH_TOKEN = process.env.FAKESTORE_MCP_TOKEN || '';

const app = express();
app.use(express.json());

const FAKESTORE_BASE = 'https://fakestoreapi.com';

// 1. Tool Definitions
export const TOOLS: Tool[] = [
  {
    name: 'list_products',
    description: 'Fetch catalog products from the public supplier fake store catalog.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of supplier products to return (default: 10)'
        },
        category: {
          type: 'string',
          description: 'Optional category filter (e.g. "electronics", "jewelery", "men\'s clothing")'
        }
      }
    }
  },
  {
    name: 'get_product',
    description: 'Get single product details from the fake store supplier by product ID.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: {
          type: 'number',
          description: 'Numeric product ID in supplier catalog'
        }
      },
      required: ['product_id']
    }
  },
  {
    name: 'list_categories',
    description: 'List all product categories available in the supplier catalog.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// 2. Tool Execution Logic
export async function executeTool(name: string, args: Record<string, any> = {}) {
  switch (name) {
    case 'list_products': {
      let url = `${FAKESTORE_BASE}/products`;
      if (args.category) {
        url = `${FAKESTORE_BASE}/products/category/${encodeURIComponent(String(args.category))}`;
      }
      if (args.limit) {
        url += `?limit=${Number(args.limit)}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error(`FakeStore API error: ${res.statusText}`);
      const data = await res.json();
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }

    case 'get_product': {
      const res = await fetch(`${FAKESTORE_BASE}/products/${args.product_id}`);
      if (!res.ok) throw new Error(`FakeStore API error: ${res.statusText}`);
      const data = await res.json();
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }

    case 'list_categories': {
      const res = await fetch(`${FAKESTORE_BASE}/products/categories`);
      if (!res.ok) throw new Error(`FakeStore API error: ${res.statusText}`);
      const data = await res.json();
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    }

    default:
      throw new Error(`Unknown tool requested: ${name}`);
  }
}

// 3. MCP Server Instance
export function createMcpServer() {
  const server = new Server(
    { name: 'fakestore-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      return await executeTool(name, args || {});
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Tool execution failed: ${err.message || String(err)}` }]
      };
    }
  });

  return server;
}

// 4. Optional Auth Middleware
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!MCP_AUTH_TOKEN) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || token !== MCP_AUTH_TOKEN) {
    res.status(401).json({ error: 'Invalid Bearer token' });
    return;
  }

  next();
}

// 5. Routes
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', server: 'fakestore-mcp', time: new Date().toISOString() });
});

app.post('/mcp', authMiddleware, async (req: Request, res: Response) => {
  const jsonRpcMessage = req.body;
  if (!jsonRpcMessage || typeof jsonRpcMessage !== 'object') {
    res.status(400).json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'Invalid Request: body must be a JSON-RPC object' }
    });
    return;
  }

  const { method, params, id } = jsonRpcMessage;

  const requestedVersion =
    (req.headers['mcp-protocol-version'] as string) ||
    jsonRpcMessage._meta?.['io.modelcontextprotocol/protocolVersion'] ||
    params?.protocolVersion ||
    '2026-07-28';

  res.setHeader('MCP-Protocol-Version', String(requestedVersion));

  try {
    let result: any;
    if (method === 'initialize') {
      result = {
        protocolVersion: requestedVersion,
        capabilities: { tools: {} },
        serverInfo: { name: 'fakestore-mcp', version: '2.0.0' }
      };
    } else if (method === 'server/discover') {
      result = {
        protocolVersion: '2026-07-28',
        supportedProtocolVersions: ['2026-07-28', '2025-11-25', '2025-06-18', '2024-11-05'],
        serverInfo: { name: 'fakestore-mcp', version: '2.0.0' },
        capabilities: { tools: {} }
      };
    } else if (method === 'notifications/initialized') {
      res.status(204).end();
      return;
    } else if (method === 'tools/list') {
      result = { tools: TOOLS, ttlMs: 60000 };
    } else if (method === 'tools/call') {
      result = await executeTool(params?.name, params?.arguments || {});
    } else if (method === 'ping') {
      result = {};
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32601, message: `Method not found: ${method}` }
      });
      return;
    }

    res.json({ jsonrpc: '2.0', id: id ?? null, result });
  } catch (err: any) {
    res.status(500).json({
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32603, message: err.message || 'Internal server error' }
    });
  }
});

app.listen(PORT, () => {
  console.log(`[FakeStore MCP Server] listening on port ${PORT}`);
});
