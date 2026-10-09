# MCP Gateway on Kubernetes — Project Plan & Technical Specification

## 1. System Architecture & Component Topology

```
                                      ┌─────────────────────────────────────┐
                                      │      Nginx Ingress Controller       │
                                      │   dashboard.localtest.me            │
                                      │   store.localtest.me                │
                                      └──────────────────┬──────────────────┘
                                                         │
                         ┌───────────────────────────────┼───────────────────────────────┐
                         │                               │                               │
                         ▼                               ▼                               ▼
           ┌───────────────────────────┐   ┌───────────────────────────┐   ┌───────────────────────────┐
           │   React Dashboard (SPA)   │   │      Gateway Backend      │   │   WordPress Storefront    │
           │   Nginx Static Serving    │   │      Express / Node.js    │   │   (Official WP Image)     │
           │   namespace: gateway      │   │      namespace: gateway   │   │   namespace: woocommerce  │
           └───────────────────────────┘   └─────────────┬─────────────┘   └─────────────┬─────────────┘
                                                         │                               │
                         ┌───────────────────────────────┼──────────────┐                ▼
                         │                               │              │         ┌─────────────┐
                         ▼                               ▼              ▼         │   MariaDB   │
                ┌─────────────────┐             ┌─────────────────┐ ┌─────────┐   │ (StatefulSet│
                │ WooCommerce MCP │             │  FakeStore MCP  │ │Notes MCP│   │  Official)  │
                │ (Internal HTTP) │             │ (Internal HTTP) │ │(Internal│   └─────────────┘
                │ Bearer Token    │             │ ClusterIP       │ │ClusterIP│
                │ ns: woocommerce │             │ ns: extra-mcps  │ │ns: extra│
                └────────┬────────┘             └─────────────────┘ └─────────┘
                         │                               │
                         │                               ▼
                         │                      ┌─────────────────┐
                         ▼                      │   PostgreSQL    │
                ┌─────────────────┐             │  (Gateway DB)   │
                │ WooCommerce API │             │   namespace:    │
                │ (Internal REST) │             │   gateway       │
                │ Host/Proto hdrs │             └─────────────────┘
                └─────────────────┘
```

---

## 2. Critical Engineering Decisions & Gotcha Fixes

### 2.1 Automated WooCommerce Bootstrap (Zero Manual Steps)
- A **WP-CLI Provisioner Job** runs on first Helm install/upgrade (`helm.sh/hook: post-install,post-upgrade`):
  1. Installs WordPress Core (`wp core install ... --url=http://store.localtest.me`).
  2. Injects reverse proxy snippet in `wp-config.php`:
     ```php
     if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
         $_SERVER['HTTPS'] = 'on';
     }
     ```
  3. Configures non-plain permalinks (`wp rewrite structure '/index.php/%postname%/'`) — **mandatory** because default plain permalinks return `404 Not Found` on `/wp-json/wc/v3/...`.
  4. Activates WooCommerce plugin.
  5. Enables Cash on Delivery (COD) payment gateway.
  6. Creates API credentials (`wp wc api_key create --user=admin --description="MCP Gateway" --permissions=read_write`).
  7. Stores the resulting Consumer Key/Secret into Kubernetes Secret `woocommerce-api-keys` (or directly updates DB tables `wp_woocommerce_api_keys` using pre-shared secrets).

### 2.2 WordPress / WooCommerce REST API In-Cluster Gotchas
- **HTTPS Enforcement:** Pass `X-Forwarded-Proto: https` from WooCommerce MCP to WordPress.
- **Host Header Redirection Trap:** WordPress enforces canonical host redirection to `store.localtest.me`. If internal MCP requests hit `http://wordpress.woocommerce.svc:80`, WordPress returns a `301 Redirect` to `store.localtest.me`.
  - **Resolution:** WooCommerce MCP calls `http://wordpress.woocommerce.svc.cluster.local:80` with an explicit header: `Host: store.localtest.me`.
- **Credentials In Logs:** Credentials passed via HTTP Basic Authorization header (`Authorization: Basic base64(ck:cs)`) instead of query parameters to prevent leaking in access logs.

### 2.3 Strict NetworkPolicy Matrix
Default Deny all ingress in `woocommerce` and `extra-mcps` namespaces, with explicit pinhole allowances:

| Source Namespace / Pod | Destination Pod | Allowed Port | Protocol | Purpose |
|---|---|---|---|---|
| `ingress-nginx` | `wordpress` (`woocommerce`) | 80 | TCP | Public Storefront & Admin |
| `wordpress` | `mariadb` (`woocommerce`) | 3306 | TCP | WordPress DB access |
| `woocommerce-mcp` | `wordpress` (`woocommerce`) | 80 | TCP | WooCommerce REST API calls |
| `gateway` (`gateway`) | `woocommerce-mcp` (`woocommerce`) | 3000 | TCP | MCP tool execution |
| `gateway` (`gateway`) | `fakestore-mcp` (`extra-mcps`) | 3000 | TCP | MCP tool execution |
| `gateway` (`gateway`) | `notes-mcp` (`extra-mcps`) | 3000 | TCP | MCP tool execution |
| `gateway` (`gateway`) | `postgres` (`gateway`) | 5432 | TCP | Gateway database access |
| Any Pod | `kube-dns` (`kube-system`) | 53 | UDP/TCP | In-cluster DNS resolution (Egress) |

### 2.4 API Key Architecture (Fast Indexed Lookup)
- Raw key format: `mcp_live_<32 hex chars>`
- Prefix: `mcp_live_<first 8 hex>` (stored in plaintext for dashboard listing).
- Indexed Hash: `SHA-256(rawKey)` stored in `api_keys.key_hash`.
- Request verification: $O(1)$ database query: `SELECT * FROM api_keys WHERE key_hash = sha256(incomingKey);`
- Passwords for dashboard users hashed with `bcrypt` (work factor 12).

### 2.5 Defense-in-Depth & SSRF Protection
- **WooCommerce MCP Bearer Token:** The custom MCP server checks `Authorization: Bearer <internal_token>` configured via Secret.
- **SSRF Strict Allowlist + DNS Resolution:**
  - Cluster targets restricted to an exact list:
    - `woocommerce-mcp.woocommerce.svc.cluster.local`
    - `fakestore-mcp.extra-mcps.svc.cluster.local`
    - `notes-mcp.extra-mcps.svc.cluster.local`
  - For external URLs (if custom server added): DNS resolved to IP before fetching. IPs in RFC1918 (private), link-local (`169.254.0.0/16`), loopback (`127.0.0.0/8`), or Gateway self are strictly blocked.
- **Audit Logging of Rejections & Unknowns:**
  - `audit_log.user_id` is **nullable**.
  - If a revoked key is used: `user_id = key.user_id`, `success = false`, `error_msg = "API key revoked"`.
  - If an invalid / unknown key is used: `user_id = null`, `success = false`, `error_msg = "Invalid API key"`, with IP recorded in `input_summary`.

### 2.6 Ingress & Streamable HTTP Buffering
- Ingress annotations for Gateway `/mcp` endpoint:
  ```yaml
  nginx.ingress.kubernetes.io/proxy-buffering: "off"
  nginx.ingress.kubernetes.io/proxy-read-timeout: "600"
  nginx.ingress.kubernetes.io/proxy-send-timeout: "600"
  ```
  Prevents Nginx from buffering chunked HTTP streams or dropping idle long-polling connections.

---

## 3. Directory Layout

```
mcp-gateway-k8s/
├── plan.md
├── README.md
├── docs/
│   ├── system-design.md
│   └── threat-model.md
├── apps/
│   ├── gateway/                 # Express backend (MCP Server + Client, Auth, Audit)
│   │   ├── prisma/              # Schema & migrations
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/          # REST routes (auth, servers, members, audit, chat)
│   │   │   ├── mcp/             # MCP aggregator, client pool, runner
│   │   │   ├── services/        # Crypto (AES-256-GCM, SHA-256), Health monitor, SSRF guard
│   │   │   └── middleware/      # Auth & RBAC
│   │   └── Dockerfile
│   ├── dashboard/               # Vite + React SPA + Chat UI
│   │   ├── src/
│   │   └── Dockerfile
│   ├── woocommerce-mcp/         # Custom WooCommerce MCP server (Streamable HTTP)
│   │   ├── src/
│   │   └── Dockerfile
│   ├── fakestore-mcp/           # Secondary upstream MCP server
│   │   └── Dockerfile
│   └── notes-mcp/               # Tertiary upstream MCP server
│       └── Dockerfile
├── helm/
│   ├── charts/
│   │   ├── gateway/             # Backend, Dashboard, PostgreSQL + Migration Job
│   │   ├── woocommerce-store/   # WordPress, MariaDB, WC MCP Server, WP-CLI Job
│   │   └── extra-mcps/          # FakeStore and Notes MCP servers
│   ├── values-local.yaml        # Local k3d configuration
│   └── values-prod.yaml         # Production k3s VPS configuration
└── k8s/
    ├── namespaces.yaml
    └── network-policies.yaml    # Strict matrix enforcement
```

---

## 4. Database Schema (PostgreSQL — `gateway` namespace)

### `users`
- `id` (UUID, Primary Key)
- `email` (VARCHAR, Unique)
- `name` (VARCHAR)
- `role` (ENUM: `admin`, `member`)
- `password_hash` (VARCHAR - bcrypt)
- `created_at` (TIMESTAMP)

### `api_keys`
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key -> `users.id`)
- `name` (VARCHAR)
- `key_prefix` (VARCHAR - e.g., `mcp_live_a1b2c3d4`)
- `key_hash` (VARCHAR - indexed SHA-256 hash of full token)
- `revoked_at` (TIMESTAMP, Nullable)
- `created_at` (TIMESTAMP)

### `mcp_servers`
- `id` (UUID, Primary Key)
- `name` (VARCHAR)
- `slug` (VARCHAR, Unique - regex: `^[a-z0-9-]+$`)
- `url` (VARCHAR)
- `credential_header` (VARCHAR, Nullable - default: `Authorization`)
- `credential_value_encrypted` (VARCHAR, Nullable - AES-256-GCM)
- `enabled` (BOOLEAN, Default: `true`)
- `status` (ENUM: `connected`, `unreachable`, `disabled`)
- `created_at` (TIMESTAMP)

### `audit_log`
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key -> `users.id`, Nullable - allows logging unknown keys)
- `server_id` (UUID, Foreign Key -> `mcp_servers.id`, Nullable)
- `tool_name` (VARCHAR)
- `input_summary` (JSONB)
- `called_at` (TIMESTAMP)
- `duration_ms` (INTEGER)
- `success` (BOOLEAN)
- `error_msg` (VARCHAR, Nullable)

---

## 5. Definition of Done & Live Verification Matrix

| Test Case | Actor | Trigger / Action | Expected Result |
|---|---|---|---|
| **1. Storefront Checkout** | Admin / User | Order product on `store.localtest.me` using Cash on Delivery (COD). | Order appears in WooCommerce WP-Admin panel. |
| **2. Chat Agent Creation** | User A (Member) | Prompt chat: "Create a t-shirt product for $25". | Product created in WooCommerce; immediately visible on storefront. |
| **3. Chat Agent Query** | User A (Member) | Place order on storefront, ask chat: "What orders came in today?". | Chat returns order details; logged under User A in `audit_log`. |
| **4. External Client** | User B (Member) | Connect Claude Code / Inspector to `dashboard.localtest.me/mcp` with User B's key. | All tools discovered; executes multi-server prompt (e.g. WooCommerce + Notes). |
| **5. Key Revocation** | Admin | Revoke User B's key in Dashboard. | Next request from User B fails (`401 Unauthorized`); rejected call logged in `audit_log`. |
| **6. Server Disabling** | Admin | Disable FakeStore MCP server. | FakeStore tools immediately disappear from Chat and External MCP clients. |
| **7. Upstream Outage** | Operator | Kill `woocommerce-mcp` pod (`kubectl delete pod ...`). | Dashboard flags server as `unreachable`; other MCP servers execute normally without hanging. |
| **8. Audit Verification** | Admin | Inspect Audit Log in Dashboard. | Shows complete chronological record attributed accurately to User A and User B. |

---

## 6. Implementation Phasing & Milestones

### Phase 0: Test Harness & Local Cluster Bootstrap
- Verify `k3d`, `kubectl`, `helm`.
- Provision k3d cluster with Ingress controller enabled:
  ```bash
  k3d cluster create mcp-cluster --port "80:80@loadbalancer" --k3s-arg "--disable=traefik@server:0"
  ```
- Deploy standard Ingress-Nginx controller.
- Create namespaces (`gateway`, `woocommerce`, `extra-mcps`).

### Phase 1: Storage & Automated WooCommerce Deployment
- Deploy MariaDB StatefulSet with PVC (`woocommerce` namespace).
- Deploy WordPress Deployment with PVC (`wordpress:6.5-apache`).
- Deploy WP-CLI bootstrap job (core install, reverse-proxy patch, permalinks, WooCommerce plugin activation, COD enabling, API keys generation).
- Configure Ingress for `store.localtest.me`.
- Verify storefront accessible and API keys active.

### Phase 2: Custom WooCommerce MCP Server
- Implement Node.js MCP server using Streamable HTTP.
- Implement tools: `list_products`, `create_product`, `list_orders`, `get_order`, `update_order_status`.
- Call WordPress via `http://wordpress.woocommerce.svc.cluster.local` with `Host: store.localtest.me` and `X-Forwarded-Proto: https`.
- Protect server endpoint with internal Bearer Token (`woocommerce-mcp-token`).
- Build Docker image, import into k3d (`k3d image import`), deploy via Helm with ClusterIP service.

### Phase 3: Secondary Upstream MCP Servers
- Build `fakestore-mcp` (wraps fakestoreapi.com with `list_products`, `get_product`, `list_categories`).
- Build `notes-mcp` (in-memory/SQLite notes with `create_note`, `list_notes`, `delete_note`).
- Deploy in `extra-mcps` namespace with ClusterIP services.

### Phase 4: Gateway Engine & Database Core
- Deploy PostgreSQL StatefulSet with PVC in `gateway` namespace.
- Initialize Prisma schema and deploy database migrations + Initial Seed Job (Default Admin + Seeded WooCommerce MCP registration).
- Implement Gateway Engine:
  - Dynamic tool aggregator with `{server_slug}__{tool_name}` namespacing.
  - Upstream caller with 15s timeout, circuit-breaking status setter, and credential injection.
  - SHA-256 API key authentication and audit logging for both successful and rejected requests.
  - SSRF protection on server URL validation.
  - Streamable HTTP endpoint `/mcp` with buffer-disabled Ingress.

### Phase 5: Dashboard & Chat Agent
- Build React SPA (Tailwind / UI components):
  - Servers Management (status badge, toggle, tools modal).
  - Users & API Key issuance/revocation.
  - Live Audit Log table.
- Implement Chat Agent:
  - Multi-turn tool execution loop resolving through internal Gateway tool engine.
  - LLM client configurable via environment variables (`OPENAI_API_KEY`, `OPENAI_MODEL`).
  - Session inheritance: Chat tool calls explicitly attributed to logged-in user.
- Package Dashboard into Nginx container, deploy Ingress routing to `/` and Gateway API to `/api` and `/mcp`.

### Phase 6: Hardening, Policies & Production Values
- Configure `network-policies.yaml` adhering strictly to the traffic matrix in Section 2.3.
- Apply resource requests/limits and liveness/readiness probes to all pods.
- Create `values-local.yaml` and `values-prod.yaml` demonstrating configuration-only portability.

### Phase 7: Verification & Documentation Deliverables
- Execute full 8-point Definition of Done live test sequence.
- Write `README.md` (Local & VPS instructions, reproduction guide).
- Write `docs/system-design.md` (Architecture, tradeoffs, tool routing).
- Write `docs/threat-model.md` (Isolation, credential boundaries, prompt injection risks, SSRF defense).
