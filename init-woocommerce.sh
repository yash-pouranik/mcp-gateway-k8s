#!/usr/bin/env bash
set -e

KUBECONFIG=${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}
export KUBECONFIG

echo "⏳ Waiting for WordPress pod to be in Ready condition..."
kubectl --kubeconfig "$KUBECONFIG" wait --for=condition=ready pod -l app.kubernetes.io/name=wordpress -n woocommerce --timeout=180s

WP_POD=$(kubectl --kubeconfig "$KUBECONFIG" get pod -l app.kubernetes.io/name=wordpress -n woocommerce -o jsonpath='{.items[0].metadata.name}')
echo "Found WordPress pod: $WP_POD"

echo "🔧 Installing WP-CLI inside WordPress container..."
kubectl --kubeconfig "$KUBECONFIG" exec -n woocommerce "$WP_POD" -- curl -sO https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
kubectl --kubeconfig "$KUBECONFIG" exec -n woocommerce "$WP_POD" -- chmod +x wp-cli.phar

echo "🚀 Checking/Installing WordPress core..."
kubectl --kubeconfig "$KUBECONFIG" exec -n woocommerce "$WP_POD" -- php wp-cli.phar core install \
  --path=/var/www/html \
  --url="http://store.urbackend.in" \
  --title="Urumi WooCommerce Store" \
  --admin_user="admin" \
  --admin_password="AdminSecurePassword123!" \
  --admin_email="admin@example.com" \
  --skip-email \
  --allow-root || true

echo "⚙️ Configuring permalink structure for REST API support..."
kubectl --kubeconfig "$KUBECONFIG" exec -n woocommerce "$WP_POD" -- php wp-cli.phar rewrite structure '/index.php/%postname%/' --path=/var/www/html --hard --allow-root

echo "🛒 Installing and Activating WooCommerce..."
kubectl --kubeconfig "$KUBECONFIG" exec -n woocommerce "$WP_POD" -- php wp-cli.phar plugin install woocommerce --version=8.9.3 --activate --path=/var/www/html --allow-root || true
kubectl --kubeconfig "$KUBECONFIG" exec -n woocommerce "$WP_POD" -- php wp-cli.phar plugin activate woocommerce --path=/var/www/html --allow-root || true

echo "💳 Enabling Cash on Delivery (COD)..."
kubectl --kubeconfig "$KUBECONFIG" exec -n woocommerce "$WP_POD" -- php wp-cli.phar option update woocommerce_cod_settings '{"enabled":"yes","title":"Cash on delivery","description":"Pay with cash upon delivery.","instructions":"","enable_for_methods":[],"enable_for_virtual":"yes"}' --format=json --path=/var/www/html --allow-root

echo "🔑 Provisioning WooCommerce REST API Keys for MCP Gateway..."
kubectl --kubeconfig "$KUBECONFIG" exec -n woocommerce "$WP_POD" -- php wp-cli.phar eval --path=/var/www/html --allow-root '
global $wpdb;
$consumer_key = "ck_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b";
$consumer_secret = "cs_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b";

if (!function_exists("wc_api_hash")) {
    require_once WP_PLUGIN_DIR . "/woocommerce/includes/wc-core-functions.php";
}

$hashed_key = wc_api_hash($consumer_key);
$table_name = $wpdb->prefix . "woocommerce_api_keys";

$existing = $wpdb->get_var($wpdb->prepare("SELECT key_id FROM $table_name WHERE description = %s", "MCP Gateway"));
if ($existing) {
    $wpdb->update($table_name, array(
        "consumer_key" => $hashed_key,
        "consumer_secret" => $consumer_secret,
        "truncated_key" => substr($consumer_key, -7),
        "permissions" => "read_write"
    ), array("key_id" => $existing));
    echo "Updated existing MCP Gateway API keys in database.\n";
} else {
    $wpdb->insert($table_name, array(
        "user_id" => 1,
        "description" => "MCP Gateway",
        "permissions" => "read_write",
        "consumer_key" => $hashed_key,
        "consumer_secret" => $consumer_secret,
        "truncated_key" => substr($consumer_key, -7)
    ));
    echo "Created new MCP Gateway API keys in database.\n";
}
'

echo "🔄 Flushing rewrite rules..."
kubectl --kubeconfig "$KUBECONFIG" exec -n woocommerce "$WP_POD" -- php wp-cli.phar rewrite flush --path=/var/www/html --allow-root

echo "=========================================================="
echo "🎉 WooCommerce Storefront & REST API keys provisioned successfully!"
echo "=========================================================="
