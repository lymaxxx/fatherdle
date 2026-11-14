import { describe, it, expect } from "vitest";
import http from "http";
import { AddressInfo } from "net";
import { nodeFetch } from "../db/node-fetch";

describe("nodeFetch", () => {
  it("sends method, headers and body, and returns a Response", async () => {
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ method: req.method, auth: req.headers.authorization, body }));
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    const { port } = server.address() as AddressInfo;
    const res = await nodeFetch(`http://127.0.0.1:${port}/x`, {
      method: "PUT",
      headers: { authorization: "Bearer t" },
      body: JSON.stringify({ a: 1 }),
    });
    const json = await res.json();
    server.close();
    expect(res.status).toBe(200);
    expect(json).toEqual({ method: "PUT", auth: "Bearer t", body: '{"a":1}' });
  });
});
