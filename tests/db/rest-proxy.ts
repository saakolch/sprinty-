import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * Test-only stand-in for Supabase's Kong gateway.
 *
 * `@supabase/supabase-js` always requests `${url}/rest/v1/...`. In production
 * Kong strips that prefix; local PostgREST expects the bare `/habits` path.
 * This proxy does the same rewrite, so the client code under test is the real
 * client with no URL hacks.
 */

const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "content-length",
  "accept-encoding",
  "transfer-encoding",
]);

export interface RestProxy {
  url: string;
  close: () => Promise<void>;
}

export async function startRestProxy(target: string): Promise<RestProxy> {
  const prefix = "/rest/v1";

  const server = createServer(async (req, res) => {
    try {
      const incoming = req.url ?? "/";
      if (!incoming.startsWith(prefix)) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ message: "not found" }));
        return;
      }

      const chunks: Buffer[] = [];
      if (req.method !== "GET" && req.method !== "HEAD") {
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
      }
      const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (!HOP_BY_HOP.has(key) && typeof value === "string") headers[key] = value;
      }
      if (body) headers["content-length"] = String(body.length);

      const response = await fetch(target + incoming.slice(prefix.length), {
        method: req.method,
        headers,
        body,
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        if (key !== "content-encoding" && key !== "transfer-encoding") {
          responseHeaders[key] = value;
        }
      });

      const payload = Buffer.from(await response.arrayBuffer());
      responseHeaders["content-length"] = String(payload.length);
      res.writeHead(response.status, responseHeaders);
      res.end(payload);
    } catch (error) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: String(error) }));
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
