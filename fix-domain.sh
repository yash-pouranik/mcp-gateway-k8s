#!/usr/bin/env bash
set -e

KUBECONFIG=${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}
export KUBECONFIG

echo "🔧 Finding WordPress pod..."
WP_POD=$(kubectl --kubeconfig "$KUBECONFIG" get pod -l app.kubernetes.io/name=wordpress -n woocommerce -o jsonpath='{.items[0].metadata.name}')
echo "WordPress Pod: $WP_POD"

echo "🌐 Updating WordPress Site URL and Home to https://store.urbackend.in..."
kubectl --kubeconfig "$KUBECONFIG" exec -n woocommerce "$WP_POD" -- php wp-cli.phar option update siteurl "https://store.urbackend.in" --allow-root
kubectl --kubeconfig "$KUBECONFIG" exec -n woocommerce "$WP_POD" -- php wp-cli.phar option update home "https://store.urbackend.in" --allow-root

echo "🔄 Replacing legacy and http URLs with https in database..."
kubectl --kubeconfig "$KUBECONFIG" exec -n woocommerce "$WP_POD" -- php wp-cli.phar search-replace "http://store.urbackend.in" "https://store.urbackend.in" --all-tables --allow-root || true
kubectl --kubeconfig "$KUBECONFIG" exec -n woocommerce "$WP_POD" -- php wp-cli.phar search-replace "https://store.13.232.229.227.nip.io" "https://store.urbackend.in" --all-tables --allow-root || true
kubectl --kubeconfig "$KUBECONFIG" exec -n woocommerce "$WP_POD" -- php wp-cli.phar search-replace "http://store.13.232.229.227.nip.io" "https://store.urbackend.in" --all-tables --allow-root || true

echo "🧹 Flushing rewrite rules and cache..."
kubectl --kubeconfig "$KUBECONFIG" exec -n woocommerce "$WP_POD" -- php wp-cli.phar rewrite flush --allow-root
kubectl --kubeconfig "$KUBECONFIG" exec -n woocommerce "$WP_POD" -- php wp-cli.phar cache flush --allow-root || true

echo "=========================================================="
echo "✅ WordPress domain updated! CSS & assets will now load cleanly!"
echo "=========================================================="
