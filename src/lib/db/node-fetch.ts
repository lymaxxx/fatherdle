import http from "http";
import https from "https";

/**
 * A minimal fetch built on Node's http/https modules. Used for Netlify Blobs because the
 * platform fetch was hanging inside the Next.js server function.
 */
export async function nodeFetch(input: string | URL | Request, init: RequestInit = {}): Promise<Response> {
  const url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url);
  const method = (init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const headers: Record<string, string> = {};
  new Headers(init.headers || (input instanceof Request ? input.headers : undefined)).forEach((v, k) => {
    headers[k] = v;
  });

  let body: Buffer | undefined;
  const b = init.body;
  if (typeof b === "string") body = Buffer.from(b);
  else if (b instanceof ArrayBuffer) body = Buffer.from(b);
  else if (ArrayBuffer.isView(b)) body = Buffer.from(b.buffer, b.byteOffset, b.byteLength);
  else if (b instanceof Blob) body = Buffer.from(await b.arrayBuffer());
  else if (b != null) body = Buffer.from(await new Response(b as BodyInit).arrayBuffer());
  if (body) headers["content-length"] = String(body.length);

  const lib = url.protocol === "http:" ? http : https;
  return new Promise<Response>((resolve, reject) => {
    const req = lib.request(url, { method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const h = new Headers();
        for (const [k, v] of Object.entries(res.headers)) {
          if (Array.isArray(v)) v.forEach((x) => h.append(k, x));
          else if (v != null) h.set(k, String(v));
        }
        const status = res.statusCode || 500;
        const payload = status === 204 || status === 304 ? null : Buffer.concat(chunks);
        resolve(new Response(payload, { status, statusText: res.statusMessage, headers: h }));
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    if (init.signal) {
      init.signal.addEventListener("abort", () => req.destroy(new Error("aborted")));
    }
    if (body) req.write(body);
    req.end();
  });
}

/** Times a plain request with both fetch implementations, for /api/health. */
export async function probeNetwork(url = "https://api.netlify.com/api/v1/"): Promise<Record<string, string>> {
  const time = async (label: string, f: typeof fetch) => {
    const t = Date.now();
    try {
      const r = await Promise.race([
        f(url),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout 3s")), 3000)),
      ]);
      return `${label}: ${r.status} in ${Date.now() - t}ms`;
    } catch (e) {
      return `${label}: ${e instanceof Error ? e.message : String(e)} after ${Date.now() - t}ms`;
    }
  };
  const g = globalThis.fetch as typeof fetch & { _nextOriginalFetch?: typeof fetch };
  const [a, b] = await Promise.all([
    time("fetch", g._nextOriginalFetch ?? g),
    time("node https", nodeFetch as typeof fetch),
  ]);
  return { fetch: a, nodeHttps: b };
}
