# 🎬 Urumi MCP Gateway — Demo Video Script & Walkthrough Guide

This script is designed for a **5 to 7-minute high-impact video demonstration** covering every single requirement and evaluation criterion for the **Urumi AI FDE Internship Round 1 Submission**.

---

## ⏱️ Video Timeline Overview

| Time | Scene / Action | Screen Focus |
| :--- | :--- | :--- |
| **0:00 - 0:45** | **Introduction & Architecture Overview** | Architecture diagram & AWS EC2 cluster overview |
| **0:45 - 1:45** | **Storefront Checkout Flow** | WooCommerce store (`https://store.urbackend.in`) |
| **1:45 - 2:45** | **User A (Admin): AI Agent Studio** | Dashboard Chat (`https://vynn.urbackend.in`) |
| **2:45 - 3:45** | **User B (Member): External MCP Client & RBAC** | Terminal / Claude Code / Postman |
| **3:45 - 4:45** | **Team Governance & Circuit Breaking** | Key revocation & Upstream pod kill resilience |
| **4:45 - 5:30** | **Observability & Security Deep-Dive** | Audit logs, AES-256-GCM, SSRF defense & NetworkPolicies |
| **5:30 - 6:00** | **Conclusion & VPS Portability Summary** | Helm values comparison (`values-local` vs `values-aws`) |

---

## 🎙️ Scene-by-Scene Script

### Scene 1: Introduction & System Architecture (0:00 – 0:45)
**Screen:** Show `docs/system-design.md` architecture diagram, then show `kubectl get pods -A` in terminal.

> *"Hello team Urumi! My name is Yash, and today I'm demonstrating our production WooCommerce hosting platform with an enterprise Team MCP Gateway deployed on Kubernetes.*
> 
> *Our architecture consists of four decoupled layers:*
> *1. A production WooCommerce store powered by WordPress 6.5 and MariaDB 11.4 with persistent volume claims.*
> *2. A custom Streamable HTTP WooCommerce MCP server that exposes the store via REST API v3.*
> *3. Two secondary upstream MCP servers: FakeStore and a persistent Notes system.*
> *4. And the core Gateway and React Dashboard running on Express, PostgreSQL 16, and Ingress-Nginx.*
> 
> *Everything you see is deployed live on a single-node AWS EC2 production K3s cluster, completely accessible at `vynn.urbackend.in` and `store.urbackend.in`."*

---

### Scene 2: Storefront Browsing & COD Checkout (0:45 – 1:45)
**Screen:** Open `https://store.urbackend.in/index.php/shop/` in browser.

> *"Let's begin with the Storefront layer.*
> 
> *Here on `store.urbackend.in`, our WooCommerce store is live with demo products like Wireless Noise-Canceling Headphones and Ergonomic Keyboards.*
> 
> *I'll click on 'Wireless Noise-Canceling Headphones', add it to the cart, and proceed to checkout.*
> 
> *I enter my customer details, select the test-friendly **Cash on Delivery (COD)** payment gateway, and click 'Place Order'.*
> 
> *The order is instantly placed with Order ID #8. Notice the clean, responsive layout served through our hardened ingress controller."*

---

### Scene 3: User A (Admin) — Autonomous Chat Agent & Tool Loop (1:45 – 2:45)
**Screen:** Switch to `https://vynn.urbackend.in` and log in as `admin@mcp-platform.local`.

> *"Now let's switch to User A, our Administrator, logged into the React Dashboard.*
> 
> *First, let's look at the **Servers view**: we see all three upstream servers—WooCommerce, FakeStore, and Notes—aggregated with live connected status indicators and 17 discovered tools.*
> 
> *Now I'll open the **AI Agent Chat tab**. Our agent is powered by the official OpenAI SDK with multi-provider routing and resilient auto-retries.*
> 
> *I'll ask the agent:*
> **'Create a new simple product called Travel Mug priced at 24.99'**
> 
> *Watch the live timeline: the agent models the intent, executes `woocommerce__create_product`, and returns the created product with ID #12.*
> *If I refresh the storefront, the Travel Mug is immediately visible!*
> 
> *Now I'll ask:*
> **'What customer orders came in today?'**
> 
> *The agent invokes `woocommerce__list_orders`, parses the JSON payload, and formats order #8 that we placed moments ago with full item details."*

---

### Scene 4: User B (Member) — External MCP Client & Granular RBAC (2:45 – 3:45)
**Screen:** Split screen between Postman/Claude Code and the Dashboard Member profile (`bob@mcp-platform.local`).

> *"Now let's test User B, a regular team Member.*
> 
> *Notice one of our key Standout Features: **Granular Tool Permissions (RBAC)**.*
> 
> *When User B connects an external MCP client (or sends a JSON-RPC request to `https://vynn.urbackend.in/mcp`) using their personal API key (`mcp_live_...`), our Gateway inspects their role.*
> 
> *When calling `tools/list`: User B only sees safe, read-only tools like `list_products`, `get_order`, and `list_notes`. All mutating tools (`create_product`, `update_order_status`, `delete_note`) are dynamically hidden.*
> 
> *Now, what if User B tries to bypass this and force-calls `woocommerce__create_product` directly?*
> *(Execute direct POST /mcp with tools/call for create_product)*
> 
> *The Gateway strictly blocks it with **HTTP 403 Forbidden: Permission Denied — Tool requires admin privileges**.*
> *This provides ironclad protection against unauthorized mutations."*

---

### Scene 5: Team Governance & Pod Kill Resilience (3:45 – 4:45)
**Screen:** Dashboard API Keys view & terminal running `kubectl delete pod`.

> *"Now let's demonstrate platform resilience and governance.*
> 
> *First, **Instant API Key Revocation**: User B's key is compromised. In the API Keys tab, I click 'Revoke'. Within 1 millisecond, their next call is rejected with HTTP 401 Unauthorized because our gateway performs fast O(1) indexed SHA-256 lookups.*
> 
> *Second, **Circuit Breaking & Fault Isolation**: What happens if an upstream server dies?*
> *In the terminal, I'll forcefully kill the FakeStore MCP pod:*
> `kubectl delete pod -l app=fakestore-mcp -n extra-mcps`
> 
> *Instantly, our background health prober detects the failure and marks FakeStore as Unreachable in the dashboard.*
> *However, WooCommerce and Notes remain 100% operational with zero downtime or cascading failures. The gateway isolates every upstream with a strict 15-second timeout sandbox."*

---

### Scene 6: Observability & Enterprise Security Hardening (4:45 – 5:30)
**Screen:** Audit Log View in dashboard, inspecting input/output JSON drawers.

> *"Let's look at the **Audit Trail**.*
> 
> *Every single tool call—whether initiated through the chat agent or an external client—is logged in dual-column JSON format with:*
> *- Authenticated User & Role*
> *- Server and Tool name*
> *- Exact execution duration in milliseconds*
> *- Rejection reasons for blocked calls*
> 
> *On the security perimeter:*
> *- **SSRF Defense**: The gateway rejects any attempt to register internal Kubernetes IPs, localhost, or AWS metadata endpoints (`169.254.169.254`).*
> *- **Zero Credential Exposure**: Upstream credentials never leave the cluster; they are encrypted at rest with AES-256-GCM.*
> *- **Zero-Trust NetworkPolicies**: Ingress is default-denied; MariaDB only talks to WordPress, and upstream MCPs only talk to the Gateway on internal port 3000."*

---

### Scene 7: Conclusion & VPS Portability (5:30 – 6:00)
**Screen:** Show `helm/values-local.yaml` vs `helm/values-aws.yaml` side-by-side.

> *"Finally, portability: our entire platform uses three clean Helm charts.*
> *Switching from local development on `k3d` to our live AWS EC2 cluster required **zero code modifications**—only Helm value overrides for domain routing, TLS, and storage.*
> 
> *All source code, documentation, threat models, and setup guides are available in our GitHub repository.*
> *Thank you, Urumi team!"*
