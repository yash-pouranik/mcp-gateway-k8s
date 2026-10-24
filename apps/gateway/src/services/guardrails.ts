/**
 * Enterprise E-Commerce Guardrails Engine for VYNN MCP Gateway
 *
 * Implements:
 * 1. Human-In-The-Loop (HITL) confirmation gates for destructive actions (delete_product, delete_note)
 * 2. Financial integrity & pricing guardrails (reject negative, zero, or inverted sale prices)
 * 3. Inventory bounds validation (no negative stock quantities)
 * 4. Blast-radius containment (max tool calls per turn)
 * 5. PII sanitization and masking (phone numbers, payment card digits)
 * 6. MCP envelope unwrapper to prevent raw JSON dumps in UI
 */

export interface GuardrailCheckResult {
  allowed: boolean;
  rejectionReason?: string;
  sanitizedArgs?: Record<string, any>;
  requiresConfirmation?: boolean;
}

// Confirmation regex for human-in-the-loop validation
const CONFIRMATION_REGEX = /\b(confirm|confirmed|proceed|approve|approved|yes[, ]*(delete|proceed|remove|do it)|haan[, ]*(delete|kardo)|definitely|go ahead)\b/i;

// Destructive tool patterns that require explicit user confirmation
const DESTRUCTIVE_TOOLS = [
  'delete_product',
  'delete_note',
  'delete_category',
  'delete_order',
  'trash_product'
];

/**
 * Validate a tool call before gateway dispatch
 */
export function evaluateToolGuardrails(
  toolName: string,
  args: Record<string, any>,
  latestUserPrompt: string,
  toolCallCountInTurn: number
): GuardrailCheckResult {
  const cleanTool = toolName.includes('__') ? toolName.split('__')[1] : toolName;

  // 1. Blast Radius Control: Max 8 tool executions per single user turn
  if (toolCallCountInTurn > 8) {
    return {
      allowed: false,
      rejectionReason: `Blast Radius Guardrail: Maximum of 8 tool calls permitted per turn to protect store stability. Please confirm or refine your request to proceed in smaller batches.`
    };
  }

  // 2. Destructive Action / HITL Confirmation Gate
  if (DESTRUCTIVE_TOOLS.includes(cleanTool)) {
    const isExplicitlyConfirmed = CONFIRMATION_REGEX.test(latestUserPrompt);
    if (!isExplicitlyConfirmed) {
      return {
        allowed: false,
        requiresConfirmation: true,
        rejectionReason: `HITL_CONFIRMATION_REQUIRED: Deletion of '${cleanTool}' is a destructive action. You must first provide a dry-run summary (item ID and title/name) and ask the user for explicit confirmation before proceeding.`
      };
    }
  }

  // 3. Financial Integrity & Pricing Validation
  const priceFields = ['regular_price', 'sale_price', 'price'];
  for (const field of priceFields) {
    if (args[field] !== undefined && args[field] !== null && args[field] !== '') {
      const num = parseFloat(String(args[field]));
      if (isNaN(num) || num <= 0) {
        return {
          allowed: false,
          rejectionReason: `Financial Guardrail Violation: '${field}' must be a positive number greater than 0 (received: ${args[field]}). Negative or zero prices are not permitted.`
        };
      }
      if (num > 1000000) {
        return {
          allowed: false,
          rejectionReason: `Financial Guardrail Violation: '${field}' exceeds maximum allowable threshold of 1,000,000 (received: ${args[field]}).`
        };
      }
    }
  }

  // Cross-field pricing: sale_price must be strictly lower than regular_price
  if (args.regular_price && args.sale_price) {
    const reg = parseFloat(String(args.regular_price));
    const sale = parseFloat(String(args.sale_price));
    if (!isNaN(reg) && !isNaN(sale) && sale >= reg) {
      return {
        allowed: false,
        rejectionReason: `Financial Guardrail Violation: 'sale_price' (${sale}) must be strictly less than 'regular_price' (${reg}).`
      };
    }
  }

  // 4. Inventory Sanity Validation
  if (args.stock_quantity !== undefined && args.stock_quantity !== null) {
    const stock = Number(args.stock_quantity);
    if (isNaN(stock) || stock < 0) {
      return {
        allowed: false,
        rejectionReason: `Inventory Guardrail Violation: 'stock_quantity' cannot be negative (received: ${args.stock_quantity}).`
      };
    }
  }

  // 5. Customer Creation Email Validation
  if (cleanTool === 'create_customer') {
    if (!args.email || typeof args.email !== 'string' || !args.email.includes('@')) {
      return {
        allowed: false,
        rejectionReason: `Validation Guardrail Violation: A valid email address is required to create a customer.`
      };
    }
  }

  return { allowed: true };
}

/**
 * Redact sensitive PII (credit cards, full phone numbers) from output
 */
export function maskSensitiveData(text: string): string {
  if (!text || typeof text !== 'string') return text;

  // Mask 13-16 digit payment card numbers: ****-****-****-1234
  let masked = text.replace(/\b(?:\d{4}[ -]?){3}(\d{4})\b/g, '****-****-****-$1');

  // Mask 10-12 digit phone numbers: keep country/area code and last 4 digits
  masked = masked.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?(\d{4})\b/g, (match, prefix, last4) => {
    return prefix ? `${prefix}******${last4}` : `******${last4}`;
  });

  return masked;
}

/**
 * Unwrap raw MCP tool JSON envelopes if the model accidentally returns tool JSON
 */
export function unwrapToolContentEnvelope(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  const trimmed = raw.trim();

  // Pattern: {"content":[{"type":"text","text":"..."}]}
  if (trimmed.startsWith('{"content":') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed.content) && parsed.content[0]?.text) {
        let innerText = parsed.content[0].text;
        // If inner text is itself JSON array/object, try to make it readable
        try {
          const innerJson = JSON.parse(innerText);
          if (Array.isArray(innerJson)) {
            return `### Retrieved ${innerJson.length} item(s):\n\n` +
              innerJson.slice(0, 10).map((item: any) => {
                const title = item.name || item.title || item.id || 'Item';
                const price = item.price || item.regular_price ? ` — $${item.price || item.regular_price}` : '';
                return `- **#${item.id || ''} ${title}**${price} (Status: ${item.status || 'unknown'})`;
              }).join('\n') +
              (innerJson.length > 10 ? `\n\n*...and ${innerJson.length - 10} more items.*` : '');
          }
        } catch (_) {
          return innerText;
        }
        return innerText;
      }
    } catch (_) {
      // not JSON, return as-is
    }
  }

  return raw;
}
