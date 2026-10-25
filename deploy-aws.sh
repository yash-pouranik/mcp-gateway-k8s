#!/usr/bin/env bash
set -e

# Ensure KUBECONFIG is set for both root and normal users
export KUBECONFIG=${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}

echo "=========================================================="
echo "🚀 Starting AWS EC2 K3s Deployment for MCP Platform"
echo "=========================================================="

# 1. Apply Namespaces
echo "📦 Creating Kubernetes Namespaces..."
kubectl apply -f k8s/namespaces.yaml

# 2. Build Docker Images using repo root context
echo "🔨 Building Docker Images..."

echo " -> [1/5] Building WooCommerce MCP..."
docker build -f apps/woocommerce-mcp/Dockerfile -t mcp-platform/woocommerce-mcp:v1.0.2 .

echo " -> [2/5] Building FakeStore MCP..."
docker build -f apps/fakestore-mcp/Dockerfile -t mcp-platform/fakestore-mcp:v1.0.0 .

echo " -> [3/5] Building Notes MCP..."
docker build -f apps/notes-mcp/Dockerfile -t mcp-platform/notes-mcp:v1.0.1 .

echo " -> [4/5] Building Gateway Backend (with Observability & Prometheus)..."
docker build -f apps/gateway/Dockerfile -t mcp-platform/gateway:v1.0.25 .

echo " -> [5/5] Building Dashboard Frontend (Multi-stage build)..."
docker build -f apps/dashboard/Dockerfile -t mcp-platform/dashboard:v1.0.31 .

# 3. Import images into K3s containerd
echo "🚚 Importing Images into K3s containerd..."
docker save mcp-platform/woocommerce-mcp:v1.0.2 | k3s ctr images import -
docker save mcp-platform/fakestore-mcp:v1.0.0 | k3s ctr images import -
docker save mcp-platform/notes-mcp:v1.0.1 | k3s ctr images import -
docker save mcp-platform/gateway:v1.0.25 | k3s ctr images import -
docker save mcp-platform/dashboard:v1.0.31 | k3s ctr images import -

# 4. Deploy Helm Charts using values-aws.yaml
echo "⚓ Deploying Helm Charts..."

echo " -> Deploying Extra MCPs (fakestore & notes)..."
helm upgrade --install extra-mcps helm/charts/extra-mcps \
  --kubeconfig /etc/rancher/k3s/k3s.yaml \
  -f helm/values-aws.yaml \
  -n extra-mcps

echo " -> Deploying WooCommerce Store & WooCommerce MCP..."
helm upgrade --install woocommerce-store helm/charts/woocommerce-store \
  --kubeconfig /etc/rancher/k3s/k3s.yaml \
  -f helm/values-aws.yaml \
  -n woocommerce

echo " -> Deploying Gateway Hub & React Dashboard..."
helm upgrade --install gateway helm/charts/gateway \
  --kubeconfig /etc/rancher/k3s/k3s.yaml \
  -f helm/values-aws.yaml \
  -n gateway

# 5. Ensure all pods are restarted with the newly built images
echo "🔄 Rolling out updated pods to load new images..."
kubectl --kubeconfig /etc/rancher/k3s/k3s.yaml rollout restart deployment/gateway -n gateway
kubectl --kubeconfig /etc/rancher/k3s/k3s.yaml rollout restart deployment/dashboard -n gateway
kubectl --kubeconfig /etc/rancher/k3s/k3s.yaml rollout restart deployment/woocommerce-mcp -n woocommerce
kubectl --kubeconfig /etc/rancher/k3s/k3s.yaml rollout restart deployment/notes-mcp -n extra-mcps

echo "⏳ Waiting for rollouts to finish..."
kubectl --kubeconfig /etc/rancher/k3s/k3s.yaml rollout status deployment/gateway -n gateway --timeout=90s
kubectl --kubeconfig /etc/rancher/k3s/k3s.yaml rollout status deployment/dashboard -n gateway --timeout=90s
kubectl --kubeconfig /etc/rancher/k3s/k3s.yaml rollout status deployment/woocommerce-mcp -n woocommerce --timeout=90s
kubectl --kubeconfig /etc/rancher/k3s/k3s.yaml rollout status deployment/notes-mcp -n extra-mcps --timeout=90s

# 6. Initialize WooCommerce inside the live WordPress container
echo "🛠️ Initializing WooCommerce Storefront..."
bash init-woocommerce.sh

echo "=========================================================="
echo "✅ All components deployed successfully! Pod status:"
echo "=========================================================="
kubectl --kubeconfig /etc/rancher/k3s/k3s.yaml get pods -A
