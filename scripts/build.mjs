import { build } from "esbuild";
import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const out = resolve(root, "dist/client");
await mkdir(out, { recursive: true });
await Promise.all(
  ["index.html", "favicon.svg"].map((file) =>
    copyFile(resolve(root, "client", file), resolve(out, file)),
  ),
);
await build({
  entryPoints: [resolve(root, "client/app.jsx")],
  bundle: true,
  minify: true,
  outfile: resolve(out, "app.js"),
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});
const assets = {};
for (const [path, type] of [
  ["index.html", "text/html"],
  ["app.js", "text/javascript"],
  ["app.css", "text/css"],
  ["favicon.svg", "image/svg+xml"],
]) {
  assets[path === "index.html" ? "/" : "/" + path] = [
    type,
    await readFile(resolve(out, path), "utf8"),
  ];
}
const worker = `import {api} from './server/api.mjs';
const assets=${JSON.stringify(assets)};
export default {async fetch(req,env){const p=new URL(req.url).pathname;if(p.startsWith('/api/'))return api(req,env);const a=assets[p];return a?new Response(a[1],{headers:{'Content-Type':a[0]+'; charset=utf-8','X-Content-Type-Options':'nosniff'}}):new Response('Страница не найдена',{status:404});}};`;
await build({
  stdin: { contents: worker, resolveDir: root },
  bundle: true,
  minify: true,
  format: "esm",
  platform: "browser",
  outfile: resolve(root, "dist/server/index.js"),
});
console.log("Интерфейс и сервер собраны.");
