#!/usr/bin/env node
import http from "node:http";
import { Readable } from "node:stream";

const PORT = Number.parseInt(process.env.SAKANA_FUGU_PROXY_PORT ?? "8787", 10);
const HOST = process.env.SAKANA_FUGU_PROXY_HOST ?? "127.0.0.1";
const UPSTREAM_ORIGIN = process.env.SAKANA_FUGU_UPSTREAM_ORIGIN ?? "https://api.sakana.ai";
const REVIEW_MODEL = process.env.SAKANA_REVIEW_MODEL ?? process.env.SAKANA_MODEL ?? "fugu-ultra-20260615";
const ALLOWED_TOOL_TYPES = new Set(
  (process.env.SAKANA_FUGU_ALLOWED_TOOL_TYPES ?? "function,custom")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
);

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function patchRequestBody(body, contentType) {
  if (!body.length || !contentType.toLowerCase().includes("application/json")) {
    return body;
  }

  const payload = JSON.parse(body.toString("utf8"));
  if (payload.model === "codex-auto-review") {
    payload.model = REVIEW_MODEL;
  }

  if (Array.isArray(payload.tools)) {
    payload.tools = payload.tools.filter((tool) => ALLOWED_TOOL_TYPES.has(tool?.type));
    if (payload.tools.length === 0) {
      delete payload.tools;
    }
  }

  return Buffer.from(JSON.stringify(payload), "utf8");
}

function toUpstreamUrl(req) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `${HOST}:${PORT}`}`);
  return new URL(`${url.pathname}${url.search}`, UPSTREAM_ORIGIN);
}

function upstreamHeaders(req) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;
    const normalized = key.toLowerCase();
    if (normalized === "host" || normalized === "content-length") continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, value);
    }
  }

  if (!headers.has("authorization") && process.env.SAKANA_API_KEY) {
    headers.set("authorization", `Bearer ${process.env.SAKANA_API_KEY}`);
  }
  return headers;
}

function responseHeaders(upstream, transformed = false) {
  const headers = {};
  upstream.headers.forEach((value, key) => {
    const normalized = key.toLowerCase();
    if (transformed && (normalized === "content-length" || normalized === "content-encoding")) {
      return;
    }
    headers[key] = value;
  });
  return headers;
}

async function patchModelsResponse(upstream, res) {
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return false;
  }

  const json = JSON.parse(await upstream.text());
  if (Array.isArray(json.data) && !json.models) {
    json.models = json.data.map((model) => ({
      ...model,
      slug: model.slug ?? model.id,
      name: model.name ?? model.id,
    }));
  }

  const body = Buffer.from(JSON.stringify(json), "utf8");
  res.writeHead(upstream.status, {
    ...responseHeaders(upstream, true),
    "content-type": "application/json; charset=utf-8",
    "content-length": String(body.length),
  });
  res.end(body);
  return true;
}

async function handle(req, res) {
  if ((req.method === "GET" || req.method === "HEAD") && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(req.method === "HEAD" ? undefined : JSON.stringify({ ok: true }));
    return;
  }

  try {
    const rawBody = await readRequestBody(req);
    const body = patchRequestBody(rawBody, req.headers["content-type"] ?? "");
    const upstreamUrl = toUpstreamUrl(req);
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: upstreamHeaders(req),
      body: body.length > 0 ? body : undefined,
      redirect: "manual",
    });

    if (upstreamUrl.pathname.endsWith("/models") && (await patchModelsResponse(upstream, res))) {
      return;
    }

    res.writeHead(upstream.status, responseHeaders(upstream));
    if (upstream.body) {
      Readable.fromWeb(upstream.body).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "sakana_fugu_proxy_error", message: error.message }));
  }
}

const server = http.createServer(handle);
server.listen(PORT, HOST, () => {
  console.error(`Sakana Fugu proxy listening on http://${HOST}:${PORT}/v1`);
});
