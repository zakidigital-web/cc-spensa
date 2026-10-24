import http from "node:http";
import handler from "./index.js";
import { networkInterfaces } from "node:os";

const PORT = Number(process.env.PORT) || 3000;

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
      console.log(`Node server running on port ${PORT}`);
    });
  }

  const lanIp = getLocalIp();
  console.log("══════════════════════════════════════════════════════════");
  console.log("  🎓 PORTAL RESMI CERDAS CERMAT IFP — SERVER AKTIF");
  console.log("  🐘 Cloud Database: Neon PostgreSQL Connected");
  console.log("══════════════════════════════════════════════════════════");
  console.log(`  ➜  Lokal:    http://localhost:${PORT}/`);
  console.log(`  ➜  Jaringan: http://${lanIp}:${PORT}/ (Gunakan di HP/IFP)`);
  console.log(`  ➜  API Health: http://localhost:${PORT}/api/health`);
  console.log("══════════════════════════════════════════════════════════");
}

export default handler;
