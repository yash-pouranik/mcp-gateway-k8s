import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

const ALGORITHM = 'aes-256-gcm';

function getSecretKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  if (secret.length === 64) {
    return Buffer.from(secret, 'hex');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptCredential(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function main() {
  console.log('Seeding initial gateway data...');

  // 1. Seed Admin User
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@mcp-platform.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPass123!';
  const adminHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'System Administrator',
      email: adminEmail,
      role: 'admin',
      passwordHash: adminHash,
    },
  });
  console.log(`Admin user ensured: ${admin.email} (ID: ${admin.id})`);

  // 2. Seed Default Member (User A)
  const memberAEmail = 'member_a@mcp-platform.local';
  const memberAPassword = 'MemberPass123!';
  const memberAHash = await bcrypt.hash(memberAPassword, 12);

  const memberA = await prisma.user.upsert({
    where: { email: memberAEmail },
    update: {},
    create: {
      name: 'Developer Alice',
      email: memberAEmail,
      role: 'member',
      passwordHash: memberAHash,
    },
  });
  console.log(`Member A ensured: ${memberA.email}`);

  // 3. Seed Default Member (User B)
  const memberBEmail = 'member_b@mcp-platform.local';
  const memberBPassword = 'MemberPass123!';
  const memberBHash = await bcrypt.hash(memberBPassword, 12);

  const memberB = await prisma.user.upsert({
    where: { email: memberBEmail },
    update: {},
    create: {
      name: 'Developer Bob',
      email: memberBEmail,
      role: 'member',
      passwordHash: memberBHash,
    },
  });
  console.log(`Member B ensured: ${memberB.email}`);

  // 4. Seed Known API Key for Member B (to fulfill Test Case 4 & 5)
  const knownKeyB = 'mcp_live_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const keyBHash = hashApiKey(knownKeyB);
  const existingKeyB = await prisma.apiKey.findUnique({ where: { keyHash: keyBHash } });
  if (!existingKeyB) {
    await prisma.apiKey.create({
      data: {
        userId: memberB.id,
        name: "Bob's Primary Key",
        keyPrefix: 'mcp_live_bbbbbbbb',
        keyHash: keyBHash,
      },
    });
    console.log(`Seeded API key for Member B: ${knownKeyB}`);
  }

  // 5. Seed Upstream MCP Servers
  // Server 1: WooCommerce MCP Server
  const wcToken = process.env.WOOCOMMERCE_MCP_TOKEN || 'mcp_internal_bearer_token_secret_9988';
  const wcEncrypted = encryptCredential(`Bearer ${wcToken}`);

  await prisma.mcpServer.upsert({
    where: { slug: 'woocommerce' },
    update: {
      url: 'http://woocommerce-mcp.woocommerce.svc.cluster.local:3000/mcp',
      credentialHeader: 'Authorization',
      credentialValueEncrypted: wcEncrypted,
    },
    create: {
      name: 'WooCommerce Store',
      slug: 'woocommerce',
      url: 'http://woocommerce-mcp.woocommerce.svc.cluster.local:3000/mcp',
      credentialHeader: 'Authorization',
      credentialValueEncrypted: wcEncrypted,
      enabled: true,
      status: 'connected',
    },
  });
  console.log('WooCommerce MCP server registered.');

  // Server 2: FakeStore MCP Server
  await prisma.mcpServer.upsert({
    where: { slug: 'fakestore' },
    update: {
      url: 'http://fakestore-mcp.extra-mcps.svc.cluster.local:3000/mcp',
    },
    create: {
      name: 'FakeStore Products',
      slug: 'fakestore',
      url: 'http://fakestore-mcp.extra-mcps.svc.cluster.local:3000/mcp',
      enabled: true,
      status: 'connected',
    },
  });
  console.log('FakeStore MCP server registered.');

  // Server 3: Notes MCP Server
  await prisma.mcpServer.upsert({
    where: { slug: 'notes' },
    update: {
      url: 'http://notes-mcp.extra-mcps.svc.cluster.local:3000/mcp',
    },
    create: {
      name: 'Team Notes',
      slug: 'notes',
      url: 'http://notes-mcp.extra-mcps.svc.cluster.local:3000/mcp',
      enabled: true,
      status: 'connected',
    },
  });
  console.log('Notes MCP server registered.');

  // 6. Seed Default AI Providers
  await prisma.aiProvider.upsert({
    where: { name: 'openai' },
    update: {
      displayName: 'OpenAI (GPT-6 Luna)',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      apiKeyEnv: 'OPENAI_API_KEY',
      defaultModel: process.env.OPENAI_MODEL || 'gpt-6-luna',
      supportsTools: true,
      costTier: 'cheap',
      enabled: true,
    },
    create: {
      name: 'openai',
      displayName: 'OpenAI (GPT-6 Luna)',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      apiKeyEnv: 'OPENAI_API_KEY',
      defaultModel: process.env.OPENAI_MODEL || 'gpt-6-luna',
      supportsTools: true,
      costTier: 'cheap',
      enabled: true,
    },
  });

  await prisma.aiProvider.upsert({
    where: { name: 'gemini' },
    update: {
      displayName: 'Google (Gemini 2.5 Flash-Lite)',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      apiKeyEnv: 'GEMINI_API_KEY',
      defaultModel: 'gemini-2.5-flash-lite',
      supportsTools: true,
      costTier: 'cheap',
      enabled: true,
    },
    create: {
      name: 'gemini',
      displayName: 'Google (Gemini 2.5 Flash-Lite)',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      apiKeyEnv: 'GEMINI_API_KEY',
      defaultModel: 'gemini-2.5-flash-lite',
      supportsTools: true,
      costTier: 'cheap',
      enabled: true,
    },
  });

  await prisma.aiProvider.upsert({
    where: { name: 'groq' },
    update: {
      displayName: 'Groq (Qwen 3.6 27B / Free)',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKeyEnv: 'GROQ_API_KEY',
      defaultModel: 'qwen/qwen3.6-27b',
      supportsTools: false,
      costTier: 'free',
      enabled: true,
    },
    create: {
      name: 'groq',
      displayName: 'Groq (Qwen 3.6 27B / Free)',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKeyEnv: 'GROQ_API_KEY',
      defaultModel: 'qwen/qwen3.6-27b',
      supportsTools: false,
      costTier: 'free',
      enabled: true,
    },
  });
  console.log('Default AI Providers registered (OpenAI GPT-6 Luna, Gemini 2.5 Flash-Lite, Groq Qwen 3.6 27B).');

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
