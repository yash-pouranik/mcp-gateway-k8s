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

export const WRITABLE_PRODUCT_FIELDS = [
  'name',
  'slug',
  'type',
  'status',
  'featured',
  'catalog_visibility',
  'description',
  'short_description',
  'sku',
  'regular_price',
  'sale_price',
  'date_on_sale_from',
  'date_on_sale_to',
  'virtual',
  'downloadable',
  'manage_stock',
  'stock_quantity',
  'stock_status',
  'backorders',
  'weight',
  'dimensions',
  'shipping_class',
  'categories',
  'tags',
  'images',
  'attributes',
  'meta_data'
] as const;

export const READ_ONLY_PRODUCT_FIELDS = [
  'id',
  'permalink',
  'date_created',
  'date_created_gmt',
  'date_modified',
  'date_modified_gmt',
  'price',
  'price_html',
  'on_sale',
  'purchasable',
  'total_sales',
  'tax_status',
  'tax_class',
  'shipping_required',
  'shipping_taxable',
  'average_rating',
  'rating_count',
  'related_ids',
  'variations'
];

function normalizeProductPayload(raw: Record<string, any>) {
  const payload: Record<string, any> = {};
  const fieldsUpdated: string[] = [];
  const fieldsRejected: { field: string; reason: string }[] = [];

  for (const [key, val] of Object.entries(raw)) {
    if ((WRITABLE_PRODUCT_FIELDS as readonly string[]).includes(key)) {
      if (key === 'images' && Array.isArray(val)) {
        payload[key] = val.map((img) => (typeof img === 'string' ? { src: img } : img));
      } else if (key === 'categories' && Array.isArray(val)) {
        payload[key] = val.map((cat) => {
          if (typeof cat === 'number') return { id: cat };
          if (typeof cat === 'string' && !isNaN(Number(cat))) return { id: Number(cat) };
          if (typeof cat === 'string') return { name: cat };
          return cat;
        });
      } else if (key === 'tags' && Array.isArray(val)) {
        payload[key] = val.map((tag) => {
          if (typeof tag === 'number') return { id: tag };
          if (typeof tag === 'string' && !isNaN(Number(tag))) return { id: Number(tag) };
          if (typeof tag === 'string') return { name: tag };
          return tag;
        });
      } else if (key === 'stock_quantity' && val !== undefined && val !== null) {
        payload[key] = Number(val);
      } else if (key === 'manage_stock') {
        payload[key] = Boolean(val);
      } else {
        payload[key] = val;
      }
      fieldsUpdated.push(key);
    } else if (READ_ONLY_PRODUCT_FIELDS.includes(key)) {
      fieldsRejected.push({
        field: key,
        reason: `Field '${key}' is read-only in WooCommerce. For price changes, update 'regular_price' or 'sale_price'.`
      });
    } else {
      fieldsRejected.push({
        field: key,
        reason: `Field '${key}' is not a recognized writable WooCommerce product property.`
      });
    }
  }

  return { payload, fieldsUpdated, fieldsRejected };
}

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
    description: 'Create a new product in the WooCommerce store with full support for pricing, inventory, categories, tags, images, and shipping attributes.',
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
        sale_price: {
          type: 'string',
          description: 'Discounted sale price (e.g., "19.99")'
        },
        description: {
          type: 'string',
          description: 'Detailed description of the product (HTML or plain text)'
        },
        short_description: {
          type: 'string',
          description: 'Short promotional summary of the product'
        },
        status: {
          type: 'string',
          enum: ['publish', 'draft', 'pending', 'private'],
          description: 'Initial publication status (default: "publish")'
        },
        sku: {
          type: 'string',
          description: 'Unique Stock Keeping Unit (SKU) identifier'
        },
        slug: {
          type: 'string',
          description: 'URL-friendly slug (e.g. "wireless-headphones")'
        },
        manage_stock: {
          type: 'boolean',
          description: 'Whether stock quantity is managed at product level'
        },
        stock_quantity: {
          type: 'number',
          description: 'Available stock quantity (e.g., 25)'
        },
        stock_status: {
          type: 'string',
          enum: ['instock', 'outofstock', 'onbackorder'],
          description: 'Stock availability status'
        },
        backorders: {
          type: 'string',
          enum: ['no', 'notify', 'yes'],
          description: 'Backorder handling policy'
        },
        weight: {
          type: 'string',
          description: 'Product weight (e.g., "0.5")'
        },
        dimensions: {
          type: 'object',
          properties: {
            length: { type: 'string' },
            width: { type: 'string' },
            height: { type: 'string' }
          },
          description: 'Product dimensions (length, width, height)'
        },
        shipping_class: {
          type: 'string',
          description: 'Shipping class slug'
        },
        virtual: {
          type: 'boolean',
          description: 'Whether the product is virtual (no shipping needed)'
        },
        downloadable: {
          type: 'boolean',
          description: 'Whether the product is downloadable'
        },
        categories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'Category ID' }
            }
          },
          description: 'Array of categories to assign (e.g. [{"id": 15}])'
        },
        tags: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'Tag ID' },
              name: { type: 'string', description: 'Tag name' }
            }
          },
          description: 'Array of tags to assign'
        },
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              src: { type: 'string', description: 'Public image URL' },
              alt: { type: 'string', description: 'Alternative text' }
            },
            required: ['src']
          },
          description: 'Array of image objects with public URLs'
        }
      },
      required: ['name', 'regular_price']
    }
  },
  {
    name: 'get_product',
    description: 'Retrieve full details of a specific WooCommerce product by product ID, including complete JSON with categories, tags, images, inventory, SKU, and dimensions.',
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
    description: 'Update fields of an existing product (pricing, status, description, inventory, stock_quantity, SKU, categories, tags, images, dimensions, shipping). Returns clear diff of saved vs rejected fields and full updated product JSON.',
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
        slug: {
          type: 'string',
          description: 'Updated URL slug'
        },
        status: {
          type: 'string',
          enum: ['publish', 'draft', 'pending', 'private'],
          description: 'Product publication status (e.g. publish from draft)'
        },
        regular_price: {
          type: 'string',
          description: 'Updated regular price in store currency (e.g. "29.99")'
        },
        sale_price: {
          type: 'string',
          description: 'Updated sale price'
        },
        description: {
          type: 'string',
          description: 'Updated product description'
        },
        short_description: {
          type: 'string',
          description: 'Updated short summary'
        },
        sku: {
          type: 'string',
          description: 'Updated SKU'
        },
        manage_stock: {
          type: 'boolean',
          description: 'Enable or disable stock tracking at product level'
        },
        stock_quantity: {
          type: 'number',
          description: 'Updated inventory count'
        },
        stock_status: {
          type: 'string',
          enum: ['instock', 'outofstock', 'onbackorder'],
          description: 'Updated stock availability status'
        },
        backorders: {
          type: 'string',
          enum: ['no', 'notify', 'yes'],
          description: 'Backorder handling policy'
        },
        weight: {
          type: 'string',
          description: 'Product weight'
        },
        dimensions: {
          type: 'object',
          properties: {
            length: { type: 'string' },
            width: { type: 'string' },
            height: { type: 'string' }
          },
          description: 'Product dimensions'
        },
        shipping_class: {
          type: 'string',
          description: 'Shipping class slug'
        },
        virtual: {
          type: 'boolean',
          description: 'Whether product is virtual'
        },
        downloadable: {
          type: 'boolean',
          description: 'Whether product is downloadable'
        },
        categories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'Category ID' }
            }
          },
          description: 'Array of categories to assign (e.g. [{"id": 15}])'
        },
        tags: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'Tag ID' },
              name: { type: 'string', description: 'Tag name' }
            }
          },
          description: 'Array of tags to assign'
        },
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              src: { type: 'string', description: 'Public image URL' },
              alt: { type: 'string', description: 'Alternative text' }
            },
            required: ['src']
          },
          description: 'Array of image objects with public URLs'
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
    name: 'list_categories',
    description: 'List all product categories defined in the WooCommerce store catalog.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'create_category',
    description: 'Create a new product category in the WooCommerce store catalog.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Category name (e.g. "Audio & Headphones")'
        },
        description: {
          type: 'string',
          description: 'Category description'
        },
        slug: {
          type: 'string',
          description: 'Optional URL slug for category'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'list_tags',
    description: 'List all product tags defined in the WooCommerce store catalog.',
    inputSchema: {
      type: 'object',
      properties: {}
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
      const { payload } = normalizeProductPayload(args);
      if (!payload.name || !payload.regular_price) {
        throw new Error("Missing required fields for create_product: 'name' and 'regular_price' are mandatory.");
      }
      const product = await wcClient.createProduct(payload);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(product, null, 2)
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
      const { product_id, ...rawFields } = args;
      if (!product_id) {
        throw new Error("Missing required field: 'product_id' is required to update a product.");
      }

      const { payload, fieldsUpdated, fieldsRejected } = normalizeProductPayload(rawFields);

      let updatedProduct: any = null;
      if (Object.keys(payload).length > 0) {
        updatedProduct = await wcClient.updateProduct(product_id, payload);
      } else {
        updatedProduct = await wcClient.getProduct(product_id);
      }

      // Verify if images were requested but WordPress failed to import them
      if (payload.images && payload.images.length > 0) {
        const hasImagesSaved = Array.isArray(updatedProduct.images) && updatedProduct.images.length > 0;
        if (!hasImagesSaved) {
          const imgIndex = fieldsUpdated.indexOf('images');
          if (imgIndex !== -1) {
            fieldsUpdated.splice(imgIndex, 1);
          }
          fieldsRejected.push({
            field: 'images',
            reason: "WordPress failed to download image from the provided URL. WooCommerce requires a direct public image URL ending in a valid extension (.jpg, .jpeg, .png, .webp). Google image search thumbnails (e.g. 'encrypted-tbn0.gstatic.com/images?q=...') lack file extensions and block server-side downloads."
          });
        }
      }

      const responsePayload = {
        success: true,
        product_id: Number(product_id),
        name: updatedProduct.name,
        status: updatedProduct.status,
        fields_updated: fieldsUpdated,
        fields_rejected: fieldsRejected,
        product: updatedProduct
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(responsePayload, null, 2)
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

    case 'list_categories': {
      const categories = await wcClient.listCategories();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(categories, null, 2)
          }
        ]
      };
    }

    case 'create_category': {
      if (!args.name) {
        throw new Error("Missing required field: 'name' is required to create a category.");
      }
      const category = await wcClient.createCategory({
        name: String(args.name),
        description: args.description ? String(args.description) : undefined,
        slug: args.slug ? String(args.slug) : undefined
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(category, null, 2)
          }
        ]
      };
    }

    case 'list_tags': {
      const tags = await wcClient.listTags();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(tags, null, 2)
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
