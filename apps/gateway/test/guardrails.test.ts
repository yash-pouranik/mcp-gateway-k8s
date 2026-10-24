import { evaluateToolGuardrails, maskSensitiveData, unwrapToolContentEnvelope } from '../src/services/guardrails.js';

console.log('🧪 Starting E-Commerce Guardrails Test Suite...');

// 1. Destructive Operations HITL Gate
console.log('1. Testing Destructive Actions & HITL Confirmation Gate...');
const unconfirmedCheck = evaluateToolGuardrails(
  'woocommerce__delete_product',
  { product_id: 16 },
  'delete all old products',
  1
);
if (unconfirmedCheck.allowed !== false || !unconfirmedCheck.requiresConfirmation) {
  throw new Error('FAILED: Unconfirmed delete_product should be blocked!');
}
console.log('   ✅ Unconfirmed delete_product successfully blocked.');

const confirmedCheck = evaluateToolGuardrails(
  'woocommerce__delete_product',
  { product_id: 16 },
  'yes delete product 16, I confirm',
  1
);
if (confirmedCheck.allowed !== true) {
  throw new Error('FAILED: Confirmed delete_product should be allowed!');
}
console.log('   ✅ Confirmed delete_product successfully allowed.');

// 2. Financial Integrity & Pricing Bounds
console.log('2. Testing Financial & Pricing Guardrails...');
const negativePriceCheck = evaluateToolGuardrails(
  'woocommerce__update_product',
  { product_id: 16, regular_price: '-900' },
  'update price of #16 to -900',
  1
);
if (negativePriceCheck.allowed !== false || !negativePriceCheck.rejectionReason?.includes('Financial Guardrail')) {
  throw new Error('FAILED: Negative price must be rejected!');
}
console.log('   ✅ Negative price rejected successfully.');

const zeroPriceCheck = evaluateToolGuardrails(
  'woocommerce__create_product',
  { name: 'Free Item', regular_price: '0' },
  'create product',
  1
);
if (zeroPriceCheck.allowed !== false) {
  throw new Error('FAILED: Zero price must be rejected!');
}
console.log('   ✅ Zero price rejected successfully.');

const invertedSalePriceCheck = evaluateToolGuardrails(
  'woocommerce__update_product',
  { product_id: 16, regular_price: '100', sale_price: '150' },
  'update price',
  1
);
if (invertedSalePriceCheck.allowed !== false || !invertedSalePriceCheck.rejectionReason?.includes('sale_price')) {
  throw new Error('FAILED: Inverted sale price must be rejected!');
}
console.log('   ✅ Inverted sale price rejected successfully.');

// 3. Inventory Sanity
console.log('3. Testing Inventory Bounds...');
const negativeStockCheck = evaluateToolGuardrails(
  'woocommerce__update_product',
  { product_id: 16, stock_quantity: -5 },
  'set stock',
  1
);
if (negativeStockCheck.allowed !== false || !negativeStockCheck.rejectionReason?.includes('stock_quantity')) {
  throw new Error('FAILED: Negative stock quantity must be rejected!');
}
console.log('   ✅ Negative stock quantity rejected successfully.');

// 4. Blast Radius Containment
console.log('4. Testing Blast Radius Limits...');
const blastRadiusCheck = evaluateToolGuardrails(
  'woocommerce__list_products',
  {},
  'fetch products',
  9 // 9th call in turn
);
if (blastRadiusCheck.allowed !== false || !blastRadiusCheck.rejectionReason?.includes('Blast Radius')) {
  throw new Error('FAILED: Call exceeding blast radius threshold should be blocked!');
}
console.log('   ✅ Blast radius threshold enforced successfully.');

// 5. PII Masking
console.log('5. Testing Sensitive Data & PII Masking...');
const textWithCard = 'Customer paid with card 4111 2222 3333 4444 and phone +91 9876543210.';
const masked = maskSensitiveData(textWithCard);
if (masked.includes('4111') || masked.includes('987654')) {
  throw new Error(`FAILED: PII was not masked properly: ${masked}`);
}
console.log('   ✅ Card & Phone PII masked successfully:', masked);

// 6. Raw MCP Envelope Unwrapping
console.log('6. Testing Raw MCP JSON Envelope Unwrapper...');
const rawMcpJson = JSON.stringify({
  content: [
    {
      type: 'text',
      text: JSON.stringify([{ id: 16, name: 'Ceramic Pour-Over', price: '24.00', status: 'publish' }])
    }
  ]
});
const unwrapped = unwrapToolContentEnvelope(rawMcpJson);
if (unwrapped.startsWith('{"content":') || !unwrapped.includes('Ceramic Pour-Over')) {
  throw new Error(`FAILED: Tool content not unwrapped cleanly: ${unwrapped}`);
}
console.log('   ✅ Raw MCP JSON envelope unwrapped into formatted Markdown.');

console.log('🎉 All 6 E-Commerce Guardrail Tests PASSED successfully!');
