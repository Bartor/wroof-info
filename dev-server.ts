/**
 * Dev server matching GitHub Pages static hosting, plus live-reload.
 *
 * `bun --hot index.html` uses SPA fallback and returns HTML for dynamically
 * loaded assets (THREE.TextureLoader → /badge/*.png), breaking the preview.
 * This server serves real files and reloads the browser on changes.
 */
import { watch } from "node:fs";

const ROOT = import.meta.dir;
const PORT = Number(process.env.PORT) || 3000;
const IGNORE = new Set([".git", "node_modules", ".DS_Store"]);

const LIVE_RELOAD_SNIPPET = `
<script>
(() => {
  let es;
  const connect = () => {
    es = new EventSource("/__livereload");
    es.onmessage = () => location.reload();
    es.onerror = () => {
      es.close();
      setTimeout(connect, 1000);
    };
  };
  connect();
})();
</script>
`;

const reloadClients = new Set<ReadableStreamDefaultController<Uint8Array>>();
const encoder = new TextEncoder();

function resolvePath(pathname: string): string | null {
  let path = decodeURIComponent(pathname);
  if (path === "/") path = "/index.html";
  if (path.includes("\0") || path.split("/").includes("..")) return null;
  return ROOT + path;
}

function shouldIgnore(filename: string | null): boolean {
  if (!filename) return true;
  return filename.split(/[\\/]/).some((part) => IGNORE.has(part));
}

function notifyReload() {
  const payload = encoder.encode(`data: reload\n\n`);
  for (const controller of reloadClients) {
    try {
      controller.enqueue(payload);
    } catch {
      reloadClients.delete(controller);
    }
  }
}

let reloadTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleReload() {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(notifyReload, 80);
}

watch(ROOT, { recursive: true }, (_event, filename) => {
  if (shouldIgnore(filename)) return;
  scheduleReload();
});

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/__livereload") {
      let controller!: ReadableStreamDefaultController<Uint8Array>;
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          controller = c;
          reloadClients.add(controller);
          controller.enqueue(encoder.encode(`: connected\n\n`));
        },
        cancel() {
          reloadClients.delete(controller);
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

    const filePath = resolvePath(url.pathname);
    if (!filePath) return new Response("Bad Request", { status: 400 });

    const file = Bun.file(filePath);
    if (!(await file.exists()) || file.size === 0) {
      return new Response("Not Found", { status: 404 });
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      const html = (await file.text()).replace(
        "</body>",
        `${LIVE_RELOAD_SNIPPET}</body>`,
      );
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response(file, {
      headers: file.type ? { "Content-Type": file.type } : undefined,
    });
  },
});

console.log(`http://localhost:${PORT}`);
