import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { api } from "./api.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const filename = process.env.KADR_DB || resolve(root, "data/kadr.sqlite");
if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
const sqlite = new DatabaseSync(filename);
sqlite.exec(
  "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
);
const migrations = ["0000_workspace", "0001_focus_archive"];
for (
  let index = sqlite.prepare("PRAGMA user_version").get().user_version;
  index < migrations.length;
  index++
) {
  sqlite.exec("BEGIN");
  try {
    sqlite.exec(
      readFileSync(
        resolve(root, "drizzle", migrations[index] + ".sql"),
        "utf8",
      ),
    );
    sqlite.exec("PRAGMA user_version=" + (index + 1) + "; COMMIT");
  } catch (e) {
    sqlite.exec("ROLLBACK");
    throw e;
  }
}
const prepare = (sql, values = []) => {
  const s = sqlite.prepare(sql);
  return {
    bind: (...args) => prepare(sql, args),
    all: () => ({ results: s.all(...values) }),
    first: () => s.get(...values) || null,
    run: () => ({ meta: s.run(...values) }),
    execute: () =>
      s.columns().length
        ? { results: s.all(...values) }
        : { meta: s.run(...values) },
  };
};
const DB = {
  prepare,
  batch(items) {
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      const out = items.map((s) => s.execute());
      sqlite.exec("COMMIT");
      return out;
    } catch (e) {
      sqlite.exec("ROLLBACK");
      throw e;
    }
  },
};
const listeners = new Map();
function subscribe(project, signal) {
  const encoder = new TextEncoder();
  let cleanup;
  const stream = new ReadableStream({
    start(ctrl) {
      const push = (data) => ctrl.enqueue(encoder.encode(data));
      let group = listeners.get(project);
      if (!group) {
        group = new Set();
        listeners.set(project, group);
      }
      const send = () => push("data: refresh\n\n");
      group.add(send);
      send();
      const heartbeat = setInterval(() => push(": keepalive\n\n"), 15000);
      cleanup = () => {
        clearInterval(heartbeat);
        group.delete(send);
        if (!group.size) listeners.delete(project);
        signal.removeEventListener("abort", end);
      };
      const end = () => {
        cleanup();
        ctrl.close();
      };
      signal.addEventListener("abort", end, { once: true });
    },
    cancel() {
      cleanup?.();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
const env = {
  DB,
  LOCAL: true,
  subscribe,
  notify: (project) => listeners.get(project)?.forEach((send) => send()),
};
const assets = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/app.css": ["app.css", "text/css; charset=utf-8"],
  "/favicon.svg": ["favicon.svg", "image/svg+xml"],
};
const port = Number(process.env.PORT || 4173),
  host = process.env.HOST || "127.0.0.1";
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://" + req.headers.host);
    if (url.pathname.startsWith("/api/")) {
      const cancel = new AbortController();
      res.on("close", () => cancel.abort());
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 1500000) {
          res.writeHead(413);
          res.end("Файл слишком большой");
          return;
        }
        chunks.push(chunk);
      }
      const response = await api(
        new Request(url, {
          method: req.method,
          headers: req.headers,
          body: chunks.length ? Buffer.concat(chunks) : undefined,
          signal: cancel.signal,
        }),
        env,
      );
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) Readable.fromWeb(response.body).pipe(res);
      else res.end();
      return;
    }
    const asset = assets[url.pathname];
    if (!asset || req.method !== "GET") {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": asset[1],
      "X-Content-Type-Options": "nosniff",
    });
    res.end(readFileSync(resolve(root, "dist/client", asset[0])));
  } catch (e) {
    console.error(e.message);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});
if (!existsSync(resolve(root, "dist/client/index.html")))
  throw Error("Сначала выполните npm run build");
server.listen(port, host, () =>
  console.log("Кадр: http://" + host + ":" + server.address().port),
);
