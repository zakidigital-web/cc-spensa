import http from "node:http";
import { join } from "node:path";
import { existsSync, statSync, promises as fsPromises } from "node:fs";
import { networkInterfaces } from "node:os";

// API Handlers (PostgreSQL Cloud Neon Integration)
import healthHandler from "./api/health.js";
import configHandler from "./api/config.js";
import banksHandler from "./api/banks.js";
import stateHandler from "./api/state.js";
import reportsHandler from "./api/reports.js";
import seedHandler from "./api/seed.js";

const PORT = Number(process.env.PORT) || 3000;
const ROOT = process.cwd();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav"
};

function getLocalIp() {
  try {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === "IPv4" && !net.internal) {
          return net.address;
        }
      }
    }
  } catch (e) {}
  return "localhost";
}

async function serveStaticNode(filePath, req, res) {
  try {
    const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    const content = await fsPromises.readFile(filePath);

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", Buffer.byteLength(content));
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", ext === ".html" ? "no-cache" : "public, max-age=86400");
    res.statusCode = 200;
    return res.end(content);
  } catch (err) {
    console.error("Error serving static file:", filePath, err);
    if (!res.headersSent) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.end("File not found");
    }
  }
}

/**
 * Universal Request Handler for Vercel Serverless & Node.js
 */
export default async function handler(req, res) {
  // If invoked in standard Node.js (req: IncomingMessage, res: ServerResponse)
  const hostHeader = req.headers ? (req.headers.host || "localhost") : "localhost";
  const rawUrl = req.url || "/";
  const url = new URL(rawUrl, `http://${hostHeader}`);
  let pathname = decodeURIComponent(url.pathname);

  // Normalize static asset paths if requested with a prefix (e.g., /penyisihan/css/... -> /css/...)
  if (pathname.includes('/css/')) pathname = pathname.slice(pathname.indexOf('/css/'));
  else if (pathname.includes('/js/')) pathname = pathname.slice(pathname.indexOf('/js/'));
  else if (pathname.includes('/vendor/')) pathname = pathname.slice(pathname.indexOf('/vendor/'));
  else if (pathname.includes('/templates/')) pathname = pathname.slice(pathname.indexOf('/templates/'));

  // Handle CORS Preflight
  if (req.method === "OPTIONS") {
    if (res && typeof res.setHeader === "function") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.statusCode = 204;
      return res.end();
    }
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  }

  // ─── API ROUTES ───
  if (pathname === "/api/health") return healthHandler(req, res);
  if (pathname === "/api/config") return configHandler(req, res);
  if (pathname === "/api/banks") return banksHandler(req, res);
  if (pathname === "/api/state") return stateHandler(req, res);
  if (pathname === "/api/reports") return reportsHandler(req, res);
  if (pathname === "/api/seed") return seedHandler(req, res);

  // ─── PAGE REWRITES ───
  if (pathname === "/penyisihan" || pathname === "/penyisihan-cerdas-cermat") {
    pathname = "/penyisihan-cerdas-cermat.html";
  } else if (pathname === "/semifinal" || pathname === "/semifinal-cerdas-cermat") {
    pathname = "/semifinal-cerdas-cermat.html";
  } else if (pathname === "/final" || pathname === "/final-cerdas-cermat") {
    pathname = existsSync(join(ROOT, "final-cerdas-cermat.html"))
      ? "/final-cerdas-cermat.html"
      : "/Cerdas Cermat Final fix.html";
  } else if (pathname === "/" || pathname === "") {
    pathname = "/index.html";
  }

  const filePath = join(ROOT, pathname);

  // If running in Bun with Web Request (no res object provided)
  if (!res || typeof res.setHeader !== "function") {
    if (typeof Bun !== "undefined") {
      if (existsSync(filePath) && statSync(filePath).isFile()) {
        const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
        const mime = MIME_TYPES[ext] || "application/octet-stream";
        return new Response(Bun.file(filePath), {
          headers: {
            "Content-Type": mime,
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=86400"
          }
        });
      }
      return new Response(Bun.file(join(ROOT, "index.html")), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache"
        }
      });
    }
  }

  // Standard Node.js / Vercel Serverless handling
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    return await serveStaticNode(filePath, req, res);
  }

  // Only fallback to index.html for page navigation without file extension
  const hasExtension = Boolean(pathname.match(/\.[a-zA-Z0-9]+$/));
  if (!hasExtension) {
    const indexPath = join(ROOT, "index.html");
    if (existsSync(indexPath)) {
      return await serveStaticNode(indexPath, req, res);
    }
  }

  res.statusCode = 404;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.end("Not Found: " + pathname);
}

// ─── STANDALONE SERVER STARTUP (Local Dev / Docker / VPS) ───
if (!process.env.VERCEL && (import.meta.url === `file://${process.argv[1]}` || process.env.STANDALONE === "true")) {
  if (typeof Bun !== "undefined") {
    Bun.serve({
      port: PORT,
      fetch(req) {
        return handler(req);
      }
    });
  } else {
    const server = http.createServer((req, res) => {
      handler(req, res);
    });
    server.listen(PORT, () => {
      const lanIp = getLocalIp();
      console.log("══════════════════════════════════════════════════════════");
      console.log("  🎓 PORTAL RESMI CERDAS CERMAT IFP — SERVER NODE.JS AKTIF");
      console.log("  🐘 Cloud Database: Neon PostgreSQL Connected");
      console.log("══════════════════════════════════════════════════════════");
      console.log(`  ➜  Lokal:    http://localhost:${PORT}/`);
      console.log(`  ➜  Jaringan: http://${lanIp}:${PORT}/ (Gunakan di HP/IFP)`);
      console.log(`  ➜  API Health: http://localhost:${PORT}/api/health`);
      console.log("══════════════════════════════════════════════════════════");
    });
  }
}
