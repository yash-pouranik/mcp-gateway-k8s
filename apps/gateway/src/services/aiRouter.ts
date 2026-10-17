import { prisma } from '../db.js';
import { UpstreamTool } from '../mcp/upstream.js';

export interface ProviderExecutionConfig {
  providerName: string;
  displayName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  supportsTools: boolean;
  costTier: string;
  routedReason?: string;
}

class AIRouter {
  /**
   * Get all enabled AI providers from database
   */
  async getProviders() {
    return prisma.aiProvider.findMany({
      where: { enabled: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Resolve execution config for requested provider (or auto-route)
   */
  async resolveProvider(
    requestedProvider: string | undefined,
    userMessage: string,
    availableTools: UpstreamTool[]
  ): Promise<ProviderExecutionConfig> {
    const providers = await this.getProviders();

    // Default fallback if DB is not yet populated
    const defaultOpenAi: ProviderExecutionConfig = {
      providerName: 'openai',
      displayName: 'OpenAI (GPT-6 Luna)',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-6-luna',
      supportsTools: true,
      costTier: 'cheap',
      routedReason: 'Default OpenAI provider (GPT-6 Luna)',
    };

    if (providers.length === 0) {
      return defaultOpenAi;
    }

    // 1. Manual Provider Selection
    if (requestedProvider && requestedProvider !== 'auto') {
      const match = providers.find((p) => p.name.toLowerCase() === requestedProvider.toLowerCase());
      if (match) {
        const apiKey = process.env[match.apiKeyEnv] || '';
        return {
          providerName: match.name,
          displayName: match.displayName,
          baseUrl: match.baseUrl,
          apiKey,
          model: match.defaultModel,
          supportsTools: match.supportsTools,
          costTier: match.costTier,
          routedReason: `User manually selected ${match.displayName}`,
        };
      }
    }

    // 2. Intelligent Auto-Routing
    // Rules:
    // - If task requires tools (WooCommerce, FakeStore, Notes), route to OpenAI (GPT-6 Luna) or Gemini 2.5 Flash-Lite
    // - If task is pure conversational / Q&A / chit-chat with no tool invocation needed, route to Groq free tier
    const actionKeywords = [
      'product', 'order', 'note', 'cart', 'buy', 'create', 'update', 'delete',
      'list', 'show', 'fetch', 'inventory', 'item', 'customer', 'status',
      'woocommerce', 'store', 'price', 'check', 'manage'
    ];

    const lowerMsg = userMessage.toLowerCase();
    const needsTools = availableTools.length > 0 && actionKeywords.some((kw) => lowerMsg.includes(kw));

    if (!needsTools) {
      // Find Groq free tier provider
      const groq = providers.find((p) => p.name === 'groq' && p.enabled);
      const groqKey = groq ? process.env[groq.apiKeyEnv] : '';

      if (groq && groqKey) {
        return {
          providerName: groq.name,
          displayName: groq.displayName,
          baseUrl: groq.baseUrl,
          apiKey: groqKey,
          model: groq.defaultModel,
          supportsTools: false,
          costTier: 'free',
          routedReason: 'Classified as conversational Q&A — routed to Groq Free Tier (Llama 3.3)',
        };
      }
    }

    // Tools required or Groq not available: Pick OpenAI (GPT-6 Luna - cheapest high-quality tool calling)
    const openai = providers.find((p) => p.name === 'openai' && p.enabled);
    if (openai) {
      return {
        providerName: openai.name,
        displayName: openai.displayName,
        baseUrl: openai.baseUrl,
        apiKey: process.env[openai.apiKeyEnv] || process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || openai.defaultModel,
        supportsTools: true,
        costTier: openai.costTier,
        routedReason: 'Tool execution required — routed to OpenAI (GPT-6 Luna)',
      };
    }

    // Secondary tool fallback: Gemini 2.5 Flash-Lite
    const gemini = providers.find((p) => p.name === 'gemini' && p.enabled);
    if (gemini) {
      return {
        providerName: gemini.name,
        displayName: gemini.displayName,
        baseUrl: gemini.baseUrl,
        apiKey: process.env[gemini.apiKeyEnv] || '',
        model: gemini.defaultModel,
        supportsTools: true,
        costTier: gemini.costTier,
        routedReason: 'Tool execution required — routed to Google Gemini (2.5 Flash-Lite)',
      };
    }

    return defaultOpenAi;
  }
}

export const aiRouter = new AIRouter();
