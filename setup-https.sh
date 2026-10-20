#!/usr/bin/env bash
set -e

export KUBECONFIG=${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}

echo "=========================================================="
echo "🔒 Setting up Production HTTPS (Let's Encrypt + cert-manager)"
echo "=========================================================="

# 1. Install cert-manager CRDs and controllers
echo "📦 [1/6] Installing cert-manager v1.14.4..."
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.4/cert-manager.yaml

echo "⏳ [2/6] Waiting for cert-manager deployments to become healthy..."
kubectl rollout status deployment/cert-manager -n cert-manager --timeout=120s
kubectl rollout status deployment/cert-manager-cainjector -n cert-manager --timeout=120s
kubectl rollout status deployment/cert-manager-webhook -n cert-manager --timeout=120s

# Sleep 5s to ensure webhook is fully operational
sleep 5

# 2. Apply ACME Solver NetworkPolicies
echo "🛡️ [3/6] Applying ACME Solver Zero-Trust NetworkPolicies..."
kubectl apply -f k8s/network-policies.yaml

# 3. Apply Let's Encrypt ClusterIssuer
echo "📜 [4/6] Configuring Let's Encrypt Production ClusterIssuer..."
kubectl apply -f k8s/cluster-issuer.yaml

# 4. Upgrade Helm charts with HTTPS Ingress & SSL redirect
echo "⚓ [5/6] Upgrading Helm charts with HTTPS & SSL Redirects..."
helm upgrade --install gateway helm/charts/gateway \
  --kubeconfig /etc/rancher/k3s/k3s.yaml \
  -f helm/values-aws.yaml \
  -n gateway

helm upgrade --install woocommerce-store helm/charts/woocommerce-store \
  --kubeconfig /etc/rancher/k3s/k3s.yaml \
  -f helm/values-aws.yaml \
  -n woocommerce

# 5. Fix WordPress URLs to HTTPS in MySQL
echo "🌐 [6/6] Enforcing HTTPS URLs in WordPress database..."
bash fix-domain.sh

echo "=========================================================="
echo "✅ HTTPS Configuration Applied! Certificate status:"
echo "=========================================================="
kubectl get certificates -A
echo ""
echo "🎉 Ingress URLs are now secured with SSL & auto-redirect:"
echo "   - Dashboard: https://vynn.urbackend.in"
echo "   - Storefront: https://store.urbackend.in"
