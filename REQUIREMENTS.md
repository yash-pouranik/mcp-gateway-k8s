# System Requirements & Functional Specifications

## 1. Problem Statement
Build a WooCommerce hosting platform with a team Model Context Protocol (MCP) gateway on Kubernetes, using a WooCommerce store as its first data source. 
An admin connects MCP servers once in a dashboard, and every team member can then access all tools through a single authenticated MCP endpoint and via a chat agent in the dashboard.

The entire system runs on local Kubernetes (k3d/Kind) and is deployable to a production VPS (k3s) using identical Helm charts with configuration-only changes.

---

## 2. System Layers
1. **Store:** WooCommerce store (WordPress + WooCommerce engine) running on Kubernetes with persistent storage.
2. **WooCommerce MCP Server:** Custom-built MCP server exposing store products and orders as tools over Streamable HTTP. Internal-only (ClusterIP).
3. **Gateway & Dashboard:** React dashboard and Express backend where admins register MCP servers. The backend acts as an MCP client to upstream servers and an MCP server exposing aggregated tools through a single endpoint.
4. **Chat Agent:** Dashboard chat interface utilizing an LLM to execute tools through the gateway on behalf of the logged-in user.

---

## 3. User Stories

### As an Administrator:
- Open dashboard to view registered MCP servers, their live status (`Connected` / `Unreachable` / `Disabled`), and exposed tools.
- See the custom WooCommerce MCP server pre-registered as the primary data source.
- Register additional MCP servers by URL and credential; edit, disable, or remove them.
- Invite team members, issue API keys, and revoke keys instantly.
- View a centralized audit log: user, server, tool, timestamp, duration, and success/failure outcome.

### As a Team Member:
- Generate personal API keys in the dashboard.
- Connect external MCP clients (Cursor, Claude Code, MCP Inspector) using only the single gateway URL and personal API key.
- Access tools across all enabled servers without handling upstream credentials.
- Use the built-in dashboard chat agent to query and mutate store data.
- Never see or handle raw upstream server credentials.

---

## 4. Definition of Done & Verification Scenarios

### Scenario A: Store Checkout
- Navigate to the storefront, add a product to the cart, and complete checkout via Cash on Delivery (COD).
- Verify the completed order appears in WooCommerce admin.

### Scenario B: Chat Agent Execution (User A)
- Request the chat agent to create a product (name and price). Verify product renders on the storefront.
- Place an order for that product manually on the storefront.
- Query the chat agent for today's orders; verify it returns the newly created order.

### Scenario C: External MCP Client (User B)
- Connect an external client (Claude Code, Cursor, or MCP Inspector) using the Gateway endpoint and User B's API key.
- Discover tools across all enabled servers and query order data.
- Execute a multi-server prompt requiring tools from two distinct upstream servers.

### Scenario D: Governance & Failure Containment
- Revoke User B's key; verify subsequent calls are immediately rejected (HTTP 401) and logged in the audit trail.
- Disable an upstream server; verify its tools immediately disappear from discovery endpoints.
- Kill an upstream server pod; verify remaining servers continue operating and the dashboard flags the failed server as `Unreachable`.
- Verify all operations appear in the audit log attributed to the correct user.

---

## 5. Mandatory Technical Requirements

### Kubernetes & Helm
- Support local Kubernetes (k3d/Kind) and production VPS (k3s).
- Package all components using Helm charts (no Kustomize). Environment differences handled via `values-local.yaml` and `values-prod.yaml`.
- All workloads run in-cluster: Storefront, MariaDB, WooCommerce MCP, Gateway, Dashboard, and PostgreSQL.
- Persistent storage (PVCs) for WordPress uploads and databases.
- Ingress with stable URLs (`*.localtest.me` locally).
- Liveness/readiness probes and resource requests/limits on all workloads.
- Zero hardcoded secrets; configuration injected via Kubernetes Secrets.

### WooCommerce MCP Server
- Custom-built (no third-party WooCommerce MCP plugins).
- Speaks MCP over Streamable HTTP.
- Exposes tools: `list_products`, `create_product`, `list_orders`, `get_order`, `update_order_status`.
- Internal-only ClusterIP; strictly inaccessible from outside the cluster.

### Gateway Engine
- Manage upstream servers with optional static credentials (header or bearer token).
- Single MCP endpoint aggregating tools across all enabled servers.
- Deterministic tool collision resolution (`{server_slug}__{tool_name}`).
- Isolated execution: dead or slow upstreams do not degrade other servers; calls enforce timeouts.
- Zero credential leakage: upstream credentials never exposed to clients or browsers.
- Connect at least three upstream servers: WooCommerce MCP + two secondary servers.

### Security & Access Control
- RBAC roles: `admin` and `member`.
- Hashed API key storage with instant revocation checks.
- Audit log recording user, server, tool, timestamp, duration, and status.

### Chat Agent
- Multi-turn tool execution loop resolving function calls through the Gateway.
- Inherits logged-in user context for accurate audit attribution.
- Configurable model and provider credentials stored in Kubernetes Secrets.

---

## 6. Architecture & Deliverables
- Source code: `apps/gateway`, `apps/dashboard`, `apps/woocommerce-mcp`, `apps/fakestore-mcp`, `apps/notes-mcp`.
- Helm charts: `helm/charts/gateway`, `helm/charts/woocommerce-store`, `helm/charts/extra-mcps`.
- Documentation:
  - `README.md` (Setup and execution guide).
  - `docs/system-design.md` (Architecture, routing, failure handling).
  - `docs/threat-model.md` (Security boundaries, SSRF guard, credential isolation).
