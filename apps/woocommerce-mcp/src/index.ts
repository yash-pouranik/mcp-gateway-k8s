import express, { Request, Response, NextFunction } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { WooCommerceClient } from './wc-client.js';

const PORT = process.env.PORT || 3000;
const MCP_AUTH_TOKEN = process.env.WOOCOMMERCE_MCP_TOKEN || 'mcp_internal_bearer_token_secret_9988';

const app = express();
app.use(express.json());

const wcClient = new WooCommerceClient();

// 1. Tool Definitions
export const TOOLS: Tool[] = [
  {
    name: 'list_products',
    description: 'List products currently available in the WooCommerce store with optional filtering by status or search keyword.',
    inputSchema: {
      type: 'object',
      properties: {
        per_page: {
          type: 'number',
          description: 'Number of products to return (default: 10, max: 50)'
        },
        search: {
          type: 'string',
          description: 'Keyword to search products by title or description'
        },
        status: {
          type: 'string',
          enum: ['publish', 'draft', 'pending', 'any'],
          description: 'Product publication status'
        }
      }
    }
  },
  {
    name: 'create_product',
    description: 'Create a new simple product in the WooCommerce store.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Product name/title'
        },
        regular_price: {
          type: 'string',
          description: 'Product price in store currency (e.g., "25.00")'
        },
        description: {
          type: 'string',
          description: 'Detailed description of the product'
        },
        short_description: {
          type: 'string',
          description: 'Short promotional summary of the product'
        },
        status: {
          type: 'string',
          enum: ['publish', 'draft', 'pending'],
          description: 'Initial publication status (default: "publish")'
        }
      },
      required: ['name', 'regular_price']
    }
  },
  {
    name: 'list_orders',
    description: 'List customer orders placed in the WooCommerce store with optional status and date filters.',
    inputSchema: {
      type: 'object',
      properties: {
        per_page: {
          type: 'number',
          description: 'Number of orders to retrieve (default: 10)'
        },
        status: {
          type: 'string',
          enum: ['any', 'pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'],
          description: 'Filter orders by status'
        },
        after: {
          type: 'string',
          description: 'Limit response to orders published after a given ISO 8601 compliant date (e.g., "2026-10-10T00:00:00Z")'
        }
      }
    }
  },
  {
    name: 'get_order',
    description: 'Retrieve full details of a specific WooCommerce order by order ID.',
    inputSchema: {
      type: 'object',
      properties: {
        order_id: {
          type: 'number',
          description: 'Unique ID of the order'
        }
      },
      required: ['order_id']
    }
  },
  {
    name: 'update_order_status',
    description: 'Update the fulfillment status of an existing WooCommerce order.',
    inputSchema: {
      type: 'object',
      properties: {
        order_id: {
          type: 'number',
          description: 'Unique ID of the order to update'
        },
        status: {
          type: 'string',
          enum: ['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'],
          description: 'New status for the order'
        }
      },
      required: ['order_id', 'status']
    }
  },
  {
    name: 'get_product',
    description: 'Retrieve full details of a specific WooCommerce product by product ID.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: {
          type: 'number',
          description: 'Unique ID of the product'
        }
      },
      required: ['product_id']
    }
  },
  {
    name: 'update_product',
    description: 'Update fields of an existing product (price, description, stock status, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: {
          type: 'number',
          description: 'Unique ID of the product to update'
        },
        name: {
          type: 'string',
          description: 'Updated product title'
        },
        regular_price: {
          type: 'string',
          description: 'Updated regular price in store currency (e.g. "29.99")'
        },
        description: {
          type: 'string',
          description: 'Updated product description'
        },
        stock_status: {
          type: 'string',
          enum: ['instock', 'outofstock', 'onbackorder'],
          description: 'Updated stock availability status'
        }
      },
      required: ['product_id']
    }
  },
  {
    name: 'delete_product',
    description: 'Permanently remove a product from the WooCommerce store catalog.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: {
          type: 'number',
          description: 'Unique ID of the product to delete'
        },
        force: {
          type: 'boolean',
          description: 'Whether to permanently delete instead of trashing (default: true)'
        }
      },
      required: ['product_id']
    }
  },
  {
    name: 'list_customers',
    description: 'List registered customers in the WooCommerce store.',
    inputSchema: {
      type: 'object',
      properties: {
        per_page: {
          type: 'number',
          description: 'Number of customer records to retrieve (default: 10)'
        },
        role: {
          type: 'string',
          enum: ['all', 'customer', 'administrator'],
          description: 'Filter customers by WordPress role'
        }
      }
    }
  }
];

// 2. Direct Tool Execution Engine
export async function executeTool(name: string, args: Record<string, any> = {}) {
  switch (name) {
    case 'list_products': {
      const products = await wcClient.listProducts({
        per_page: args?.per_page ? Number(args.per_page) : undefined,
        search: args?.search ? String(args.search) : undefined,
        status: args?.status ? String(args.status) : undefined
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(products, null, 2)
          }
        ]
      };
    }

    case 'create_product': {
      const product = await wcClient.createProduct({
        name: String(args.name),
        regular_price: String(args.regular_price),
        description: args.description ? String(args.description) : undefined,
        short_description: args.short_description ? String(args.short_description) : undefined,
        status: args.status ? (args.status as any) : 'publish'
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(product, null, 2)
          }
        ]
      };
    }

    case 'list_orders': {
      const orders = await wcClient.listOrders({
        per_page: args?.per_page ? Number(args.per_page) : undefined,
        status: args?.status ? String(args.status) : undefined,
        after: args?.after ? String(args.after) : undefined
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(orders, null, 2)
          }
        ]
      };
    }

    case 'get_order': {
      const order = await wcClient.getOrder(args.order_id);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(order, null, 2)
          }
        ]
      };
    }

    case 'update_order_status': {
      const updated = await wcClient.updateOrderStatus(
        args.order_id,
        String(args.status)
      );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(updated, null, 2)
          }
        ]
      };
    }

    case 'get_product': {
      const product = await wcClient.getProduct(args.product_id);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(product, null, 2)
          }
        ]
      };
    }

    case 'update_product': {
      const { product_id, ...updateData } = args;
      const updated = await wcClient.updateProduct(product_id, updateData);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(updated, null, 2)
          }
        ]
      };
    }

    case 'delete_product': {
      const deleted = await wcClient.deleteProduct(args.product_id, args.force !== false);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(deleted, null, 2)
          }
        ]
      };
    }

    case 'list_customers': {
      const customers = await wcClient.listCustomers({
        per_page: args?.per_page ? Number(args.per_page) : undefined,
        role: args?.role ? String(args.role) : undefined
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(customers, null, 2)
          }
        ]
      };
    }

    default:
      throw new Error(`Unknown tool requested: ${name}`);
  }
}

// 3. MCP Server Instance
export function createMcpServer() {
  const server = new Server(
    {
      name: 'woocommerce-mcp',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
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
        content: [
          {
            type: 'text',
            text: `Tool execution failed: ${err.message || String(err)}`
          }
        ]
      };
    }
  });

  return server;
}

// 4. Auth Middleware (Bearer Token)
function authMiddleware(req: Request, res: Response, next: NextFunction) {
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
  res.json({
    status: 'healthy',
    server: 'woocommerce-mcp',
    time: new Date().toISOString()
  });
});

// Streamable HTTP JSON-RPC endpoint
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
        serverInfo: { name: 'woocommerce-mcp', version: '1.0.0' }
      };
    } else if (method === 'notifications/initialized') {
      res.status(204).end();
      return;
    } else if (method === 'tools/list') {
      result = { tools: TOOLS };
    } else if (method === 'tools/call') {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      result = await executeTool(toolName, toolArgs);
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

    res.json({
      jsonrpc: '2.0',
      id: id ?? null,
      result
    });
  } catch (err: any) {
    res.status(500).json({
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32603, message: err.message || 'Internal server error' }
    });
  }
});

app.listen(PORT, () => {
  console.log(`[WooCommerce MCP Server] listening on port ${PORT}`);
});
