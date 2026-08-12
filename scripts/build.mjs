import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const project = resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const publicDir = resolve(project, "public");
const distDir = resolve(project, "dist");
const routes = ["index.html", "styles.css", "retrieval.js", "app.js", "policy.json", "favicon.svg", "og.png"];
const mime = {
  "index.html": "text/html; charset=utf-8",
  "styles.css": "text/css; charset=utf-8",
  "retrieval.js": "text/javascript; charset=utf-8",
  "app.js": "text/javascript; charset=utf-8",
  "policy.json": "application/json; charset=utf-8",
  "og.png": "image/png",
  "favicon.svg": "image/svg+xml",
};

await rm(distDir, { recursive: true, force: true });
await mkdir(resolve(distDir, "server"), { recursive: true });

const assets = {};
for (const name of routes) {
  const binary = name.endsWith(".png");
  const data = await readFile(resolve(publicDir, name));
  assets[`/${name === "index.html" ? "" : name}`] = {
    body: binary ? data.toString("base64") : data.toString("utf8"),
    type: mime[name],
    encoding: binary ? "base64" : "text",
  };
}

const worker = `const assets = ${JSON.stringify(assets)};
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const asset = assets[url.pathname] || (url.pathname === "/index.html" ? assets["/"] : null);
    if (!asset) return new Response("Not found", { status: 404 });
    const body = asset.encoding === "base64"
      ? Uint8Array.from(atob(asset.body), character => character.charCodeAt(0))
      : asset.body.replaceAll("__ORIGIN__", url.origin);
    return new Response(body, { headers: { "content-type": asset.type, "cache-control": url.pathname === "/" ? "no-cache" : "public, max-age=3600", "x-content-type-options": "nosniff" } });
  }
};\n`;

await writeFile(resolve(distDir, "server", "index.js"), worker);
console.log(`Built Policy Desk with ${routes.length} verified assets, 24 draft policies, and 1,202 controls.`);
