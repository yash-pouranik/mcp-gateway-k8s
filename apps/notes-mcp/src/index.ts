import express, { Request, Response, NextFunction } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';

const PORT = process.env.PORT || 3000;
const MCP_AUTH_TOKEN = process.env.NOTES_MCP_TOKEN || '';

const app = express();
app.use(express.json());

interface Note {
  id: string;
  title: string;
  content: string;
  author?: string;
  created_at: string;
}

// In-memory note store with initial demo data
const notesStore: Map<string, Note> = new Map([
  [
    'note_1',
    {
      id: 'note_1',
      title: 'Store Restock Plan',
      content: 'Need to order 50 units of Urumi Developer Hoodies for upcoming hackathon.',
      author: 'Operations Team',
      created_at: new Date().toISOString()
    }
  ],
  [
    'note_2',
    {
      id: 'note_2',
      title: 'Payment Gateway Notes',
      content: 'Cash on delivery enabled. Working on Stripe test gateway integration.',
      author: 'Tech Lead',
      created_at: new Date().toISOString()
    }
  ]
]);

// 1. Tool Definitions
export const TOOLS: Tool[] = [
  {
    name: 'list_notes',
    description: 'List all shared team notes and operational reminders.',
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Optional keyword to search in note titles or content'
        }
      }
    }
  },
  {
    name: 'create_note',
    description: 'Create a new team note or reminder.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the note'
        },
        content: {
          type: 'string',
          description: 'Body/content of the note'
        },
        author: {
          type: 'string',
          description: 'Name of the author or team creating the note'
        }
      },
      required: ['title', 'content']
    }
  },
  {
    name: 'delete_note',
    description: 'Delete a note by its unique note ID.',
    inputSchema: {
      type: 'object',
      properties: {
        note_id: {
          type: 'string',
          description: 'ID of the note to remove (e.g. "note_1")'
        }
      },
      required: ['note_id']
    }
  },
  {
    name: 'get_note',
    description: 'Retrieve full details of a specific note by its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        note_id: {
          type: 'string',
          description: 'Unique ID of the note (e.g. "note_1")'
        }
      },
      required: ['note_id']
    }
  },
  {
    name: 'update_note',
    description: 'Update the title or body of an existing note.',
    inputSchema: {
      type: 'object',
      properties: {
        note_id: {
          type: 'string',
          description: 'ID of the note to update'
        },
        title: {
          type: 'string',
          description: 'New title for the note'
        },
        content: {
          type: 'string',
          description: 'New content body for the note'
        }
      },
      required: ['note_id']
    }
  }
];

// 2. Tool Execution Engine
export async function executeTool(name: string, args: Record<string, any> = {}) {
  switch (name) {
    case 'list_notes': {
      let list = Array.from(notesStore.values());
      if (args.search) {
        const q = String(args.search).toLowerCase();
        list = list.filter(
          n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
        );
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(list, null, 2) }]
      };
    }

    case 'create_note': {
      const id = `note_${Date.now()}`;
      const newNote: Note = {
        id,
        title: String(args.title),
        content: String(args.content),
        author: args.author ? String(args.author) : 'Member',
        created_at: new Date().toISOString()
      };
      notesStore.set(id, newNote);
      return {
        content: [{ type: 'text', text: JSON.stringify(newNote, null, 2) }]
      };
    }

    case 'delete_note': {
      const id = String(args.note_id);
      const exists = notesStore.has(id);
      if (!exists) throw new Error(`Note not found: ${id}`);
      notesStore.delete(id);
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, deleted_id: id }) }]
      };
    }

    case 'get_note': {
      const id = String(args.note_id);
      const note = notesStore.get(id);
      if (!note) throw new Error(`Note not found: ${id}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(note, null, 2) }]
      };
    }

    case 'update_note': {
      const id = String(args.note_id);
      const existing = notesStore.get(id);
      if (!existing) throw new Error(`Note not found: ${id}`);
      if (args.title) existing.title = String(args.title);
      if (args.content) existing.content = String(args.content);
      notesStore.set(id, existing);
      return {
        content: [{ type: 'text', text: JSON.stringify(existing, null, 2) }]
      };
    }

    default:
      throw new Error(`Unknown tool requested: ${name}`);
  }
}

// 3. MCP Server Instance
export function createMcpServer() {
  const server = new Server(
    { name: 'notes-mcp', version: '1.0.0' },
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

// 4. Auth Middleware
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
  res.json({ status: 'healthy', server: 'notes-mcp', time: new Date().toISOString() });
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

  try {
    let result: any;
    if (method === 'initialize') {
      result = {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'notes-mcp', version: '1.0.0' }
      };
    } else if (method === 'notifications/initialized') {
      res.status(204).end();
      return;
    } else if (method === 'tools/list') {
      result = { tools: TOOLS };
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
  console.log(`[Notes MCP Server] listening on port ${PORT}`);
});
