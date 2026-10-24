import http from "node:http";
import { join } from "node:path";
import { existsSync, statSync, createReadStream, promises as fsPromises } from "node:fs";
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

function serveStaticNode(filePath, req, res) {
  try {
    const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
    const mime = MIME_TYPES[ext] || "application/octet-stream";

    res.setHeader("Content-Type", mime);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", ext === ".html" ? "no-cache" : "public, max-age=86400");
    res.statusCode = 200;

    const stream = createReadStream(filePath);
    stream.on("error", (err) => {
      console.error("Stream error for", filePath, err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    });
    stream.pipe(res);
  } catch (err) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Error loading file");
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
  if (pathname === "/penyisihan") pathname = "/penyisihan-cerdas-cermat.html";
  else if (pathname === "/semifinal") pathname = "/semifinal-cerdas-cermat.html";
  else if (pathname === "/final") {
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
    return serveStaticNode(filePath, req, res);
  }

  // Fallback to index.html
  const indexPath = join(ROOT, "index.html");
  if (existsSync(indexPath)) {
    return serveStaticNode(indexPath, req, res);
  }

  res.statusCode = 404;
  res.end("Not Found");
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
