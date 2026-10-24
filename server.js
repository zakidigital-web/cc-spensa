import { join } from "path";
import { existsSync, statSync } from "fs";
import { networkInterfaces } from "os";

const ROOT = "/home/darkverst/workspace/CC";
const PORT = Number(process.env.PORT) || 3000;

function getLocalIp() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf"
};

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);

    // Exact rewrites matching vercel.json
    if (pathname === "/penyisihan") pathname = "/penyisihan-cerdas-cermat.html";
    else if (pathname === "/semifinal") pathname = "/semifinal-cerdas-cermat.html";
    else if (pathname === "/final") pathname = existsSync(join(ROOT, "final-cerdas-cermat.html")) ? "/final-cerdas-cermat.html" : "/Cerdas Cermat Final fix.html";
    else if (pathname === "/") pathname = "/index.html";

    let filePath = join(ROOT, pathname);

    // If file exists and is a file, serve it
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
      const mime = MIME_TYPES[ext] || "application/octet-stream";
      return new Response(Bun.file(filePath), {
        headers: {
          "Content-Type": mime,
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600"
        }
      });
    }

    // Fallback to index.html for SPA routes
    const indexPath = join(ROOT, "index.html");
    return new Response(Bun.file(indexPath), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
      }
    });
  }
});

const lanIp = getLocalIp();
console.log("══════════════════════════════════════════════════════════");
console.log("  🎓 PORTAL RESMI CERDAS CERMAT IFP — SERVER AKTIF");
console.log("══════════════════════════════════════════════════════════");
console.log(`  ➜  Lokal:    http://localhost:${PORT}/`);
console.log(`  ➜  Jaringan: http://${lanIp}:${PORT}/ (Gunakan di HP/IFP)`);
console.log("══════════════════════════════════════════════════════════");
