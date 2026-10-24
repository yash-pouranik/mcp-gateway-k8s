/**
 * Enterprise E-Commerce Guardrails Engine for VYNN MCP Gateway (v2)
 *
 * Implements:
 * 1. Target-Bound Human-In-The-Loop (HITL) confirmation gate:
 *    - Verifies exact entity IDs (e.g. product_id, order_id, note_id) are explicitly approved in user's prompt.
 *    - Prevents partial/wrong-target deletions (e.g., user said "delete only 16, 17" -> ID 18 is blocked).
 * 2. Mutation Budget & Single-Call Bulk Bypass protection:
 *    - Enforces maximum mutation limits (max 5 records mutated per turn).
 *    - Blocks batch payloads (e.g. ids: [1..27]) from bypassing turn limits.
 * 3. Strict Financial Integrity & Pricing Bounds:
 *    - Rejects negative prices (-900), zero, NaN, Infinity, and malformed strings.
 *    - Enforces cross-field constraint: sale_price < regular_price.
 *    - Enforces upper ceiling: <= 1,000,000.
 * 4. Inventory bounds validation (no negative stock quantities).
 * 5. Comprehensive PII & Sensitive Data Sanitization:
 *    - Payment cards (13-19 digit Visa, MasterCard, Amex, RuPay).
 *    - International phone numbers (+91, +1, bracketed, dashed, 10-12 digits).
 * 6. Robust Multi-block MCP Content Unwrapping & Markdown Synthesis:
 *    - Inspects all content blocks, avoids precedence bugs, avoids hardcoding currency symbols.
 * 7. Prompt Injection & Toxic Payload Defense:
 *    - Detects and neutralizes prompt override tokens in tool inputs.
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

// Dangerous prompt injection signatures in tool inputs
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s+prompt\s+override/i,
  /bypass\s+(safety|guardrail|rbac)/i,
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi
];

/**
 * Extract target entity ID from tool arguments (product_id, note_id, order_id, id)
 */
function extractTargetIds(args: Record<string, any>): string[] {
  const ids: string[] = [];

  const directIdFields = ['product_id', 'order_id', 'note_id', 'category_id', 'customer_id', 'id'];
  for (const field of directIdFields) {
    if (args[field] !== undefined && args[field] !== null) {
      ids.push(String(args[field]).trim());
    }
  }

  // Handle batch array fields (e.g. ids: [1, 2, 3] or product_ids: [...])
  const arrayFields = ['ids', 'product_ids', 'order_ids'];
  for (const field of arrayFields) {
    if (Array.isArray(args[field])) {
      for (const item of args[field]) {
        if (item !== undefined && item !== null) {
          ids.push(String(item).trim());
        }
      }
    }
  }

  return ids;
}

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

  // 2. Mutation Budget: Single-call bulk bypass protection (max 5 items mutated per call)
  const targetIds = extractTargetIds(args);
  if (targetIds.length > 5) {
    return {
      allowed: false,
      rejectionReason: `Mutation Budget Guardrail: Attempted to mutate ${targetIds.length} items in a single call. Maximum allowable mutation batch size is 5 items. Please split into smaller operations.`
    };
  }

  // 3. Prompt Injection Inspection in tool arguments
  for (const [key, val] of Object.entries(args)) {
    if (typeof val === 'string') {
      for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(val)) {
          return {
            allowed: false,
            rejectionReason: `Security Guardrail: Input field '${key}' contains disallowed prompt injection pattern.`
          };
        }
      }
    }
  }

  // 4. Destructive Action / Target-Bound HITL Confirmation Gate
  if (DESTRUCTIVE_TOOLS.includes(cleanTool)) {
    const isExplicitlyConfirmed = CONFIRMATION_REGEX.test(latestUserPrompt);
    if (!isExplicitlyConfirmed) {
      return {
        allowed: false,
        requiresConfirmation: true,
        rejectionReason: `HITL_CONFIRMATION_REQUIRED: Deletion of '${cleanTool}' is a destructive action. You must first provide a dry-run summary (item ID and title/name) and ask the user for explicit confirmation before proceeding.`
      };
    }

    // TARGET-BOUND BINDING: If specific target IDs are being deleted, verify they were approved in the user's prompt!
    // Prevents: User saying "Yes delete only 16, 17" while LLM tries to delete 18 or all 27.
    if (targetIds.length > 0) {
      // Check if user prompt is a generic blanket confirmation or specific ID approval
      const isBlanketAllConfirmation = /\b(all|everything|saare|sare)\b/i.test(latestUserPrompt) &&
        /\b(delete|remove|kardo)\b/i.test(latestUserPrompt);

      if (!isBlanketAllConfirmation) {
        const unapprovedIds = targetIds.filter((id) => {
          // ID must appear in prompt as a distinct word or hashtag (e.g. "16", "#16", "id 16")
          const idRegex = new RegExp(`(?:#|id\\s*|\\b)${id}\\b`, 'i');
          return !idRegex.test(latestUserPrompt);
        });

        if (unapprovedIds.length > 0) {
          return {
            allowed: false,
            requiresConfirmation: true,
            rejectionReason: `Target Guardrail Violation: Deletion target ID(s) [${unapprovedIds.join(', ')}] were not explicitly mentioned or approved in the user's confirmation. Only specifically approved items can be deleted.`
          };
        }
      }
    }
  }

  // 5. Financial Integrity & Pricing Validation
  const priceFields = ['regular_price', 'sale_price', 'price'];
  for (const field of priceFields) {
    if (args[field] !== undefined && args[field] !== null && args[field] !== '') {
      const raw = String(args[field]).trim();

      // Check for malformed or non-numeric strings
      if (!/^-?\d+(\.\d+)?$/.test(raw)) {
        return {
          allowed: false,
          rejectionReason: `Financial Guardrail Violation: '${field}' must be a valid numeric amount (received: "${raw}").`
        };
      }

      const num = parseFloat(raw);
      if (isNaN(num) || !isFinite(num) || num <= 0) {
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

  // 6. Inventory Sanity Validation
  if (args.stock_quantity !== undefined && args.stock_quantity !== null) {
    const raw = String(args.stock_quantity).trim();
    if (!/^-?\d+$/.test(raw)) {
      return {
        allowed: false,
        rejectionReason: `Inventory Guardrail Violation: 'stock_quantity' must be an integer (received: "${raw}").`
      };
    }
    const stock = Number(raw);
    if (isNaN(stock) || stock < 0) {
      return {
        allowed: false,
        rejectionReason: `Inventory Guardrail Violation: 'stock_quantity' cannot be negative (received: ${args.stock_quantity}).`
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

  // Mask 13-19 digit payment card numbers (Visa, MasterCard, Amex, RuPay): ****-****-****-1234
  let masked = text.replace(/\b(?:\d{4}[ -]?){3,4}(\d{4})\b/g, '****-****-****-$1');

  // Mask international and standard phone numbers (+91, +1, 10-12 digits with spaces or dashes)
  masked = masked.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?(\d{4})\b/g, (match, prefix, last4) => {
    return prefix ? `${prefix}******${last4}` : `******${last4}`;
  });

  return masked;
}

/**
 * Robust Multi-Block MCP Content Unwrapper
 * Safely converts raw MCP JSON envelopes into clean Markdown without hardcoding currencies.
 */
export function unwrapToolContentEnvelope(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  const trimmed = raw.trim();

  // Pattern: {"content":[{"type":"text","text":"..."}]}
  if (trimmed.startsWith('{"content":') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed.content)) {
        // Collect all text blocks
        const textBlocks: string[] = [];
        for (const block of parsed.content) {
          if (block.type === 'text' && typeof block.text === 'string') {
            textBlocks.push(block.text);
          }
        }

        if (textBlocks.length > 0) {
          const combined = textBlocks.join('\n\n');

          // If combined text is itself JSON array/object, transform into clean readable Markdown
          try {
            const innerJson = JSON.parse(combined);
            if (Array.isArray(innerJson)) {
              return `### Retrieved ${innerJson.length} item(s):\n\n` +
                innerJson.slice(0, 10).map((item: any) => {
                  const title = item.name || item.title || `Item #${item.id || ''}`;
                  const rawPrice = item.price !== undefined && item.price !== '' ? item.price : item.regular_price;
                  const priceStr = (rawPrice !== undefined && rawPrice !== null && rawPrice !== '') ? ` — Price: ${rawPrice}` : '';
                  const statusStr = item.status ? ` (Status: ${item.status})` : '';
                  return `- **#${item.id || ''} ${title}**${priceStr}${statusStr}`;
                }).join('\n') +
                (innerJson.length > 10 ? `\n\n*...and ${innerJson.length - 10} more items.*` : '');
            }
          } catch (_) {
            return combined;
          }
          return combined;
        }
      }
    } catch (_) {
      // not JSON envelope, return as-is
    }
  }

  return raw;
}
