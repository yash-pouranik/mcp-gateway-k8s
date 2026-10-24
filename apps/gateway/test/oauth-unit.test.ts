import { strict as assert } from 'assert';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {
  hashToken,
  generateSecureToken,
  verifyPKCE,
  issueAccessToken,
} from '../src/services/oauthService.js';

console.log('🧪 Starting OAuth 2.0 Unit & Specification Test Suite...\n');

// 1. Token Hashing & Entropy
console.log('1. Testing Token Hashing & Entropy...');
const token = generateSecureToken(32);
assert.equal(token.length, 64, '32 bytes hex should be 64 characters');
const hashed = hashToken(token);
const expectedHash = crypto.createHash('sha256').update(token).digest('hex');
assert.equal(hashed, expectedHash, 'SHA-256 hash must match crypto implementation');
console.log('   ✅ Secure token generation and SHA-256 hashing passed.');

// 2. PKCE RFC 7636 Verification (S256 & plain)
console.log('2. Testing RFC 7636 PKCE Verification...');
// Generate a code_verifier
const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
// S256 challenge calculation
const expectedChallenge = crypto
  .createHash('sha256')
  .update(codeVerifier)
  .digest('base64url');

const validS256 = verifyPKCE(codeVerifier, expectedChallenge, 'S256');
assert.equal(validS256, true, 'Valid PKCE S256 challenge must verify successfully');

const invalidS256 = verifyPKCE('wrong_verifier_here', expectedChallenge, 'S256');
assert.equal(invalidS256, false, 'Invalid PKCE S256 verifier must be rejected');

const validPlain = verifyPKCE('plain_secret', 'plain_secret', 'plain');
assert.equal(validPlain, true, 'Plain PKCE challenge must verify match');

const invalidPlain = verifyPKCE('plain_secret', 'wrong_secret', 'plain');
assert.equal(invalidPlain, false, 'Plain PKCE challenge mismatch must be rejected');
console.log('   ✅ RFC 7636 PKCE S256 & plain validation passed.');

// 3. OAuth JWT Access Token Issuance & Claims
console.log('3. Testing OAuth Access Token Claims & Structure...');
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-mcp-gateway';
const accessToken = issueAccessToken({
  userId: 'usr_123',
  clientId: 'mcp_client_test',
  scope: 'mcp:read mcp:write',
  userEmail: 'admin@vynn.io',
  userRole: 'admin',
});

const decoded = jwt.verify(accessToken, JWT_SECRET) as any;
assert.equal(decoded.sub, 'usr_123', 'sub claim must match userId');
assert.equal(decoded.client_id, 'mcp_client_test', 'client_id must match');
assert.equal(decoded.scope, 'mcp:read mcp:write', 'scope must match requested scope');
assert.equal(decoded.token_type, 'oauth_access_token', 'token_type must be oauth_access_token');
assert.ok(decoded.exp > decoded.iat, 'Token must have future expiry');
console.log('   ✅ OAuth Access Token JWT claims verified.');

// 4. Scope-Based Access Control Evaluation
console.log('4. Testing Scope-Based Access Control Evaluation...');
function checkToolScope(oauthScope: string, toolName: string): { allowed: boolean; error?: string } {
  const writeTools = ['create_product', 'update_product', 'delete_product', 'update_order_status', 'create_note', 'delete_note'];
  const adminTools = ['delete_product', 'delete_note'];

  const needsWrite = writeTools.some(t => toolName.includes(t));
  const needsAdmin = adminTools.some(t => toolName.includes(t));
  const scopes = oauthScope.split(' ');

  if (needsAdmin && !scopes.includes('mcp:admin')) {
    return { allowed: false, error: 'insufficient_scope' };
  }
  if (needsWrite && !scopes.includes('mcp:write')) {
    return { allowed: false, error: 'insufficient_scope' };
  }
  return { allowed: true };
}

// Read tool with mcp:read
const readCheck = checkToolScope('mcp:read', 'woocommerce__list_products');
assert.equal(readCheck.allowed, true, 'mcp:read must allow list_products');

// Write tool with mcp:read only -> BLOCKED
const writeCheckReadOnly = checkToolScope('mcp:read', 'woocommerce__update_product');
assert.equal(writeCheckReadOnly.allowed, false, 'mcp:read alone must block update_product');
assert.equal(writeCheckReadOnly.error, 'insufficient_scope');

// Write tool with mcp:read mcp:write -> ALLOWED
const writeCheckValid = checkToolScope('mcp:read mcp:write', 'woocommerce__update_product');
assert.equal(writeCheckValid.allowed, true, 'mcp:write must allow update_product');

// Admin tool (delete_product) with mcp:read mcp:write -> BLOCKED (needs mcp:admin)
const deleteCheckWithoutAdmin = checkToolScope('mcp:read mcp:write', 'woocommerce__delete_product');
assert.equal(deleteCheckWithoutAdmin.allowed, false, 'delete_product must require mcp:admin');

// Admin tool with mcp:admin mcp:write -> ALLOWED
const deleteCheckWithAdmin = checkToolScope('mcp:read mcp:write mcp:admin', 'woocommerce__delete_product');
assert.equal(deleteCheckWithAdmin.allowed, true, 'mcp:admin must allow delete_product');
console.log('   ✅ Scope-based access control matrix passed.');

console.log('\n🎉 ALL 4 OAUTH 2.0 SPECIFICATION & SECURITY UNIT TESTS PASSED CLEANLY!\n');
