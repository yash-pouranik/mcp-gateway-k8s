#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "🚀 Starting AWS EC2 K3s Deployment for MCP Platform"
echo "=========================================================="

# 1. Apply Namespaces
echo "📦 Creating Kubernetes Namespaces..."
kubectl apply -f k8s/namespaces.yaml

# 2. Build Docker Images
echo "🔨 Building Docker Images..."

echo " -> [1/5] Building WooCommerce MCP..."
docker build -t mcp-platform/woocommerce-mcp:v1.0.0 apps/woocommerce-mcp

echo " -> [2/5] Building FakeStore MCP..."
docker build -t mcp-platform/fakestore-mcp:v1.0.0 apps/fakestore-mcp

echo " -> [3/5] Building Notes MCP..."
docker build -t mcp-platform/notes-mcp:v1.0.0 apps/notes-mcp

echo " -> [4/5] Building Gateway Backend (with OpenAI SDK)..."
docker build -t mcp-platform/gateway:v1.0.15 apps/gateway

echo " -> [5/5] Building Dashboard Frontend..."
docker build -t mcp-platform/dashboard:v1.0.24 apps/dashboard

# 3. Import images into K3s containerd
echo "🚚 Importing Images into K3s containerd..."
docker save mcp-platform/woocommerce-mcp:v1.0.0 | sudo k3s ctr images import -
docker save mcp-platform/fakestore-mcp:v1.0.0 | sudo k3s ctr images import -
docker save mcp-platform/notes-mcp:v1.0.0 | sudo k3s ctr images import -
docker save mcp-platform/gateway:v1.0.15 | sudo k3s ctr images import -
docker save mcp-platform/dashboard:v1.0.24 | sudo k3s ctr images import -

# 4. Deploy Helm Charts using values-aws.yaml
echo "⚓ Deploying Helm Charts..."

echo " -> Deploying Extra MCPs (fakestore & notes)..."
helm upgrade --install extra-mcps helm/charts/extra-mcps \
  -f helm/values-aws.yaml \
  -n extra-mcps

echo " -> Deploying WooCommerce Store & WooCommerce MCP..."
helm upgrade --install woocommerce-store helm/charts/woocommerce-store \
  -f helm/values-aws.yaml \
  -n woocommerce

echo " -> Deploying Gateway Hub & React Dashboard..."
helm upgrade --install gateway helm/charts/gateway \
  -f helm/values-aws.yaml \
  -n gateway

echo "=========================================================="
echo "✅ Deployment submitted! Checking pods status..."
echo "=========================================================="
kubectl get pods -A
