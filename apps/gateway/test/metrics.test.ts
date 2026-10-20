import assert from 'node:assert';
import {
  register,
  mcpToolCallsTotal,
  mcpToolCallDurationSeconds,
  mcpUpstreamStatus,
  mcpUpstreamTimeoutsTotal,
  mcpAuthFailuresTotal,
  mcpActiveRequests,
  trackActiveRequest,
  recordToolCallMetric,
  recordUpstreamTimeout,
  recordAuthFailure,
  updateUpstreamStatusMetric,
  sanitizeLabelValue,
  getProcessMetricsSnapshot,
} from '../src/services/metrics.js';

async function runMetricsTests() {
  console.log('🧪 Starting Gateway Metrics & Telemetry Test Suite...\n');

  // Test 1: Label sanitization prevents unbounded cardinality & privacy leaks
  console.log('1. Testing label value sanitization...');
  assert.strictEqual(sanitizeLabelValue('woocommerce'), 'woocommerce');
  assert.strictEqual(sanitizeLabelValue('FakeStore-API!'), 'fakestore-api_');
  assert.strictEqual(sanitizeLabelValue(''), 'unknown');
  assert.strictEqual(sanitizeLabelValue('a'.repeat(100)).length, 48);
  console.log('   ✅ Label sanitization passed.\n');

  // Test 2: Active requests tracking with decrement in finally callback
  console.log('2. Testing active in-flight request tracking...');
  const initialActive = (await mcpActiveRequests.get()).values[0]?.value || 0;
  const decrement = trackActiveRequest();
  const activeDuring = (await mcpActiveRequests.get()).values[0]?.value || 0;
  assert.strictEqual(activeDuring, initialActive + 1);

  decrement();
  const activeAfter = (await mcpActiveRequests.get()).values[0]?.value || 0;
  assert.strictEqual(activeAfter, initialActive);

  // Calling decrement again should be idempotent (no double decrement)
  decrement();
  const activeIdempotent = (await mcpActiveRequests.get()).values[0]?.value || 0;
  assert.strictEqual(activeIdempotent, initialActive);
  console.log('   ✅ Active requests tracking & idempotency passed.\n');

  // Test 3: Record tool call metric (success, failure, timeout)
  console.log('3. Testing tool call metric recording & histogram observations...');
  recordToolCallMetric({
    server: 'woocommerce',
    tool: 'list_products',
    durationMs: 150,
    outcome: 'success',
  });

  recordToolCallMetric({
    server: 'fakestore',
    tool: 'get_product',
    durationMs: 350,
    outcome: 'failure',
  });

  recordToolCallMetric({
    server: 'notes',
    tool: 'create_note',
    durationMs: 15000,
    outcome: 'timeout',
  });

  const toolCallsMetric = await mcpToolCallsTotal.get();
  const wooSuccess = toolCallsMetric.values.find(
    (v) => v.labels.server === 'woocommerce' && v.labels.tool === 'list_products' && v.labels.outcome === 'success'
  );
  assert.ok(wooSuccess, 'WooCommerce success call should be recorded');
  assert.ok(wooSuccess.value >= 1, 'Value should be at least 1');

  const fakeFail = toolCallsMetric.values.find(
    (v) => v.labels.server === 'fakestore' && v.labels.tool === 'get_product' && v.labels.outcome === 'failure'
  );
  assert.ok(fakeFail, 'FakeStore failure call should be recorded');

  const notesTimeout = toolCallsMetric.values.find(
    (v) => v.labels.server === 'notes' && v.labels.tool === 'create_note' && v.labels.outcome === 'timeout'
  );
  assert.ok(notesTimeout, 'Notes timeout call should be recorded');

  const durationMetric = await mcpToolCallDurationSeconds.get();
  assert.ok(durationMetric.values.length > 0, 'Duration histogram should have bucket observations');
  console.log('   ✅ Tool call counter and duration histogram passed.\n');

  // Test 4: Upstream status multi-state gauge
  console.log('4. Testing upstream status state transitions...');
  updateUpstreamStatusMetric('woocommerce', 'connected');
  updateUpstreamStatusMetric('fakestore', 'unreachable');
  updateUpstreamStatusMetric('notes', 'disabled');

  const statusMetric = await mcpUpstreamStatus.get();

  const wooConnected = statusMetric.values.find((v) => v.labels.server === 'woocommerce' && v.labels.state === 'connected');
  const wooUnreachable = statusMetric.values.find((v) => v.labels.server === 'woocommerce' && v.labels.state === 'unreachable');
  assert.strictEqual(wooConnected?.value, 1, 'WooCommerce connected state should be 1');
  assert.strictEqual(wooUnreachable?.value, 0, 'WooCommerce unreachable state should be 0');

  const fakeUnreach = statusMetric.values.find((v) => v.labels.server === 'fakestore' && v.labels.state === 'unreachable');
  assert.strictEqual(fakeUnreach?.value, 1, 'FakeStore unreachable state should be 1');

  const notesDisabled = statusMetric.values.find((v) => v.labels.server === 'notes' && v.labels.state === 'disabled');
  assert.strictEqual(notesDisabled?.value, 1, 'Notes disabled state should be 1');
  console.log('   ✅ Upstream multi-state gauge transitions passed.\n');

  // Test 5: Upstream timeouts counter
  console.log('5. Testing upstream timeouts counter...');
  const initialTimeouts = (await mcpUpstreamTimeoutsTotal.get()).values.find((v) => v.labels.server === 'woocommerce')?.value || 0;
  recordUpstreamTimeout('woocommerce');
  const updatedTimeouts = (await mcpUpstreamTimeoutsTotal.get()).values.find((v) => v.labels.server === 'woocommerce')?.value || 0;
  assert.strictEqual(updatedTimeouts, initialTimeouts + 1);
  console.log('   ✅ Upstream timeouts counter passed.\n');

  // Test 6: Auth and RBAC failure counters
  console.log('6. Testing auth & RBAC rejection counters...');
  recordAuthFailure('missing_auth');
  recordAuthFailure('invalid_key');
  recordAuthFailure('revoked_key');
  recordAuthFailure('invalid_jwt');
  recordAuthFailure('rbac_denied');

  const authMetric = await mcpAuthFailuresTotal.get();
  for (const reason of ['missing_auth', 'invalid_key', 'revoked_key', 'invalid_jwt', 'rbac_denied'] as const) {
    const entry = authMetric.values.find((v) => v.labels.reason === reason);
    assert.ok(entry && entry.value >= 1, `Auth failure reason '${reason}' should be recorded`);
  }
  console.log('   ✅ Auth failure reasons passed.\n');

  // Test 7: Process snapshot compilation
  console.log('7. Testing in-memory process metrics snapshot...');
  const snapshot = await getProcessMetricsSnapshot();
  assert.ok(typeof snapshot.activeRequests === 'number');
  assert.ok(typeof snapshot.processLifetimeToolCalls === 'number');
  assert.ok(typeof snapshot.uptimeSeconds === 'number');
  assert.ok(snapshot.processLifetimeToolCalls >= 3);
  console.log('   ✅ Process metrics snapshot passed.\n');

  // Test 8: Prometheus registry output format
  console.log('8. Testing Prometheus text output format...');
  const promText = await register.metrics();
  assert.ok(promText.includes('mcp_tool_calls_total'), 'Metrics output should contain mcp_tool_calls_total');
  assert.ok(promText.includes('mcp_tool_call_duration_seconds_bucket'), 'Metrics output should contain histogram buckets');
  assert.ok(promText.includes('mcp_upstream_status'), 'Metrics output should contain mcp_upstream_status');
  assert.ok(promText.includes('mcp_auth_failures_total'), 'Metrics output should contain mcp_auth_failures_total');
  console.log('   ✅ Prometheus text format validated.\n');

  console.log('🎉 All 8 Gateway Observability Tests PASSED successfully!');
}

runMetricsTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
