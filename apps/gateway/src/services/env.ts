/**
 * Read a required secret/config value from the environment (injected from Kubernetes Secrets).
 * Fails fast at startup instead of silently falling back to a hardcoded default.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
