// 本地开发预览：静态文件服务 + 同源函数代理（内存样例数据，仅本地使用）
// 用法：node dev/preview-server.mjs [端口]，默认 http://127.0.0.1:8902/
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = resolve(import.meta.dirname, "..");
const distRoot = join(projectRoot, "dist");
const handlerPath = join(projectRoot, "functions", "handler.mjs");
const port = Number(process.argv[2] ?? 8902);

const { handleApp } = await import(pathToFileURL(handlerPath).href);

// 内存样例数据：25 条中文留言，仅本地预览；云端使用真实托管数据库
const sampleNames = ["林工", "小路", "阿泽", "小满", "江", ""];
let db = Array.from({ length: 25 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(25 - i).padStart(12, "0")}`,
  name: sampleNames[i % sampleNames.length],
  text: `本地样例留言 ${25 - i}：这条记录来自开发预览的内存夹具，不是云端数据库。`,
  created_at: new Date(Date.UTC(2026, 9, 1, 9, 0, 25 - i)).toISOString(),
}));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// 模拟 supabase 查询链：select / order / range / limit / insert(+select+single)
function makeSupabase() {
  return {
    from() {
      const orders = [];
      const builder = {
        select() { return builder; },
        order(col, { ascending = true } = {}) { orders.push([col, ascending]); return builder; },
        range(start, end) {
          return Promise.resolve({ data: sortRows(orders).slice(start, end + 1), error: null });
        },
        limit(n) { return Promise.resolve({ data: db.slice(0, n), error: null }); },
        insert(row) {
          db = [{ ...row }, ...db];
          const inserted = { ...row };
          return {
            select() { return this; },
            single: () => Promise.resolve({ data: inserted, error: null }),
          };
        },
      };
      return builder;
    },
  };
}

function sortRows(orders) {
  const out = [...db];
  for (const [col, asc] of [...orders].reverse()) {
    out.sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1));
  }
  return out;
}

async function readBody(incoming) {
  const chunks = [];
  for await (const chunk of incoming) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, "http://127.0.0.1");

    if (url.pathname === "/functions/v1/app") {
      const bodyBuffer = await readBody(incoming);
      const headers = {};
      if (incoming.headers["content-type"]) headers["content-type"] = incoming.headers["content-type"];
      const request = new Request(url, {
        method: incoming.method,
        headers,
        body: incoming.method === "GET" || incoming.method === "HEAD" ? undefined : bodyBuffer,
      });
      const response = await handleApp({ request, supabase: makeSupabase() });
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
      return;
    }

    if (incoming.method !== "GET" && incoming.method !== "HEAD") {
      outgoing.writeHead(405);
      outgoing.end();
      return;
    }
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const filePath = normalize(join(distRoot, pathname));
    if (!filePath.startsWith(distRoot + sep)) {
      outgoing.writeHead(403);
      outgoing.end();
      return;
    }
    const content = await readFile(filePath);
    outgoing.writeHead(200, {
      "content-type": TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    outgoing.end(content);
  } catch {
    outgoing.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    outgoing.end("未找到");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`本地预览: http://127.0.0.1:${server.address().port}/`);
});
