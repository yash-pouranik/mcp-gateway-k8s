# Security Architecture & Threat Model

## 1. Scope & System Security Boundaries

The **Urumi MCP Gateway** functions as a centralized control plane and proxy connecting AI client agents with internal Kubernetes services and third-party APIs. This document defines the security perimeters, identified threat vectors, and corresponding defensive countermeasures implemented across the architecture.

```
                      TRUST BOUNDARY 1 (Public / Client Perimeter)
                                         |
     [ External MCP Clients / Browsers ] | [ Ingress-Nginx TLS Termination ]
                                         |
=========================================v=========================================
                      TRUST BOUNDARY 2 (Gateway Control Plane)
                                         |
     [ React Dashboard (SPA) ] --------> | [ Express Gateway Engine ]
                                         |      |            |
                                         |      v            v
                                         | [PostgreSQL]  [Audit Logger]
                                         |
=========================================v=========================================
                      TRUST BOUNDARY 3 (Internal Isolated Services)
                                         |
   [ woocommerce-mcp ]        [ fakestore-mcp ]         [ notes-mcp ]
            |                        |                       |
            v                        v                       v
     [ WordPress REST ]      [ fakestoreapi.com ]      [ Local Memory ]
            |
            v
       [ MariaDB ]
```

---

## 2. Threat Analysis & Mitigations

### 2.1 Threat Vector: Server-Side Request Forgery (SSRF)
- **Risk:** An attacker with administrator privileges (or via compromised credentials) attempts to register a malicious upstream MCP server URL targeting internal cluster services, cloud instance metadata endpoints (`http://169.254.169.254`), or localhost loopback interfaces (`http://127.0.0.1`).
- **Mitigations Implemented:**
  1. **Strict Cluster Hostname Allowlist:** In-cluster endpoints must match explicitly approved service DNS patterns:
     - `woocommerce-mcp.woocommerce.svc.cluster.local`
     - `fakestore-mcp.extra-mcps.svc.cluster.local`
     - `notes-mcp.extra-mcps.svc.cluster.local`
  2. **DNS Pre-Resolution Verification:** For external hostnames, `apps/gateway/src/services/ssrf.ts` performs DNS resolution prior to connection establishment. If the resolved IP falls within:
     - Loopback (`127.0.0.0/8`, `::1`)
     - Link-Local (`169.254.0.0/16`)
     - RFC1918 Private Subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
     The registration is rejected immediately with HTTP 400.

### 2.2 Threat Vector: Credential Leakage & Privilege Escalation
- **Risk:** Upstream MCP credentials (such as WooCommerce REST API Consumer Keys and Bearer tokens) could leak into dashboard responses, MCP tool schemas, browser local storage, or audit logs.
- **Mitigations Implemented:**
  1. **Zero Credential Exposure:** Upstream server credentials (`credential_value_encrypted`) are encrypted at rest using AES-256-GCM in PostgreSQL. The Gateway decrypts them strictly in memory when dispatching an upstream request. Upstream headers are stripped from all API outputs (`GET /api/servers`).
  2. **Fast Indexed API Key Authentication:** Client tokens use the format `urumi_live_<32 hex chars>`. The gateway hashes tokens using SHA-256 before querying PostgreSQL (`api_keys.key_hash`). Plaintext keys are shown only once upon generation and are never stored in the database.
  3. **Instant Key Revocation:** Revoking a key in the dashboard sets `revoked_at = NOW()`. Subsequent tool calls fail immediately with HTTP 401 without requiring token caching expiration or restarts.
  4. **Strict Role-Based Access Control (RBAC):** Mutating endpoints (`POST /api/servers`, `PUT /api/servers/:id`, `DELETE /api/servers/:id`) require the `admin` role. Standard `member` accounts can only generate personal keys, inspect tools, and use the AI Agent.

### 2.3 Threat Vector: Lateral Movement via Compromised Pods
- **Risk:** If a public-facing pod (e.g. WordPress or Dashboard) is compromised, an attacker might attempt to pivot into database pods or upstream MCP servers.
- **Mitigations Implemented:**
  1. **Kubernetes NetworkPolicy Enforcement (`k8s/network-policies.yaml`):**
     - **Default Deny:** Ingress is blocked by default across `woocommerce`, `extra-mcps`, and `gateway` namespaces.
     - **Micro-Segmentation:** 
       - `mariadb` accepts TCP connections exclusively on port 3306 from pods labeled `app.kubernetes.io/name: wordpress`.
       - `postgres` accepts TCP connections exclusively on port 5432 from pods labeled `app: gateway`.
       - Upstream MCP servers (`woocommerce-mcp`, `fakestore-mcp`, `notes-mcp`) accept ingress exclusively from `app: gateway` on port 3000. Public ingress to upstream MCP servers is physically impossible.
  2. **Non-Root Container Hardening:** Gateway, Dashboard, and MCP microservices operate as non-root users with read-only root filesystems where applicable.

### 2.4 Threat Vector: LLM Prompt Injection & Unauthorized Tool Mutation
- **Risk:** A malicious user prompts the AI Chat Agent with indirect injection attacks to manipulate store prices, delete orders, or execute unauthorized operations.
- **Mitigations Implemented:**
  1. **Session-Inherited Audit Attribution:** Every tool invocation initiated by the AI Chat Agent runs within the authenticated context of the logged-in user. Every function call, parameters payload, duration, and status are permanently recorded in the immutable `audit_log` table.
  2. **Schema-Constrained Parameter Validation:** MCP tool calls strictly adhere to JSON Schema definitions (`inputSchema`). Unexpected parameters are rejected before reaching upstream services.
  3. **Isolated Error Boundaries:** Tool execution failures return sanitized JSON error messages to the LLM without leaking stack traces or internal cluster network topology.

---

## 3. Security Verification Checklist

- [x] Internal MCP servers run as ClusterIP with zero public Ingress.
- [x] Ingress TLS termination enabled for `store.localtest.me` and `dashboard.localtest.me`.
- [x] Secrets injected via Kubernetes Secret objects; zero plaintext secrets in Git.
- [x] API key hashes indexed using SHA-256 with $O(1)$ query latency.
- [x] Upstream credentials encrypted with AES-256-GCM at rest.
- [x] SSRF guard prevents cluster intranet scanning and cloud metadata queries.
- [x] NetworkPolicies verified blocking cross-namespace lateral connections.
