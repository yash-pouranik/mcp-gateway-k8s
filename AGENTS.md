# AGENTS.md — Instructions & Operating Guardrails for AI Agents

## 1. Project Overview
WooCommerce hosting platform with a team Model Context Protocol (MCP) Gateway on Kubernetes.
The gateway aggregates multiple upstream MCP servers behind a single authenticated Streamable HTTP endpoint (`/mcp`), paired with a React dashboard, audit logger, and an LLM chat agent.

---

## 2. Architecture & Monorepo Layout
- `apps/gateway`: Express.js backend (acts as MCP Server to clients, MCP Client to upstreams, PostgreSQL via Prisma).
- `apps/dashboard`: Vite + React + Tailwind frontend (served via Nginx).
- `apps/woocommerce-mcp`: Custom Node.js MCP server exposing WooCommerce REST API v3 over Streamable HTTP.
- `apps/fakestore-mcp`: Secondary upstream MCP server (wraps public API).
- `apps/notes-mcp`: Tertiary upstream MCP server (notes CRUD).
- `helm/`: Charts for `gateway`, `woocommerce-store`, `extra-mcps` + `values-local.yaml` & `values-prod.yaml`.
- `k8s/`: Cluster-level resources (namespaces, strict NetworkPolicies).
- Detailed specs: read [plan.md](plan.md).
- Original assignment requirements: read [REQUIREMENTS.md](REQUIREMENTS.md).

---

## 3. Build, Run & Test Commands
All commands execute using `pnpm` from repository root or respective subproject:

```bash
# Install dependencies across workspace
pnpm install

# Type-check & lint
pnpm -r run lint
pnpm -r run build

# Run unit / integration tests
pnpm -r test

# Docker build & import into local k3d cluster
docker build -t <image-name> apps/<service>
k3d image import <image-name> -c mcp-cluster

# Helm dry-run validation
helm template test-gw helm/charts/gateway -f helm/values-local.yaml
```

---

## 4. Code Style & Technical Conventions
- **TypeScript**: Strict mode enabled (`"strict": true`). No `any` without explicit justification.
- **MCP Transport**: Use Streamable HTTP (stateless mode, standard POST + SSE). Do not use stdio.
- **Tool Namespacing**: Format is `{server_slug}__{tool_name}`. Regex for slug: `^[a-z0-9-]+$`. Split only on the *first* `__`. Max length <= 64 chars.
- **API Keys**: Raw key format `mcp_live_<32 hex chars>`. Store `key_prefix` in plain text and `key_hash` as indexed `SHA-256(rawKey)`. Never use bcrypt for API key lookups. Bcrypt is strictly for user passwords.
- **Error Isolation**: Always wrap upstream MCP calls in isolated try/catch blocks with 15s timeout. Never let a single failing upstream bring down tool listing or other tool calls.
- **Container Hardening**: Containers must run as non-root (`securityContext.runAsNonRoot: true`), except WordPress which uses official Apache defaults.

---

## 5. Boundaries & Guardrails (Tiered Rules)

### Always Do:
- Run typecheck and lint before committing code.
- Ensure all secrets pass through Kubernetes Secrets; never commit plaintext secrets or tokens.
- Ensure any new tool call records an entry in `audit_log` (including failed or rejected calls).
- Wrap upstream HTTP calls with timeouts (health checks: 3s, tool calls: 15s).

### Ask First / Approval Required:
- Modifying Prisma database schemas (`schema.prisma`) or creating destructive migrations.
- Changing Kubernetes NetworkPolicy rules or Helm chart values structure.
- Adding heavy third-party npm dependencies.

### Never Do:
- **NEVER** pass upstream server credentials down to the frontend or MCP clients.
- **NEVER** expose the WooCommerce MCP server or extra MCP servers via Ingress (ClusterIP internal only).
- **NEVER** use Kustomize; Helm charts with values files (`values-local.yaml`, `values-prod.yaml`) are mandatory.
- **NEVER** hardcode cluster internal IPs; use service DNS names (`<service>.<namespace>.svc.cluster.local`).
- **NEVER** mock passing tests or suppress TypeScript compiler errors with `@ts-ignore` without human confirmation.

---

## 6. Git & Commit Guidelines
- Follow Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
- Keep commits atomic and scoped to single logical units.
