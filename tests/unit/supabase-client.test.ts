import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The browser client is the single place where the public Supabase
 * configuration enters the app. If it silently initialises with `undefined`,
 * every auth call fails at runtime with a confusing error — so assert it here.
 */
describe("supabase browser client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("initialises from the public environment variables", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");

    const { createClient } = await import("@/lib/supabase/client");
    const client = createClient();

    const internal = client as unknown as { supabaseUrl: string; supabaseKey: string };
    expect(internal.supabaseUrl).toBe("https://example.supabase.co");
    expect(internal.supabaseKey).toBe("test-publishable-key");
    expect(typeof client.from).toBe("function");
    expect(client.auth).toBeDefined();
  });

  it("fails loudly when the environment is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    const { createClient } = await import("@/lib/supabase/client");
    expect(() => createClient()).toThrow(/URL and API key are required/);
  });
});
