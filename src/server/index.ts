import index from "../client/index.html";
import { apiRoutes } from "./api.ts";
import { ensureBootstrapInvite } from "./auth.ts";
import { HQ } from "./geo.ts";
import { seedRestaurants } from "./seed.ts";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 80);
const hostname = process.env.HOST ?? "0.0.0.0";

if (process.env.SKIP_SEED !== "1") seedRestaurants();

function start() {
  try {
    return Bun.serve({
      port,
      hostname,
      development: dev,
      // 15 MB: photo uploads are capped at 12 MB plus multipart overhead.
      maxRequestBodySize: 15 * 1024 * 1024,
      routes: {
        ...apiRoutes,
        // Everything else is the single-page app.
        "/*": index,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Bun puts the useful part in `code`; the message is prose.
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? String((err as { code: unknown }).code)
        : "";

    // Ports below 1024 are privileged on Linux and macOS; say so instead of
    // dumping a bare EACCES on someone.
    if ((code === "EACCES" || /EACCES|permission denied/i.test(message)) && port < 1024) {
      console.error(`\n  Port ${port} darf nur mit erhöhten Rechten belegt werden.\n`);
      console.error("  Entweder als root starten, oder dem Bun-Binary das Recht einmalig geben:\n");
      console.error("      sudo setcap 'cap_net_bind_service=+ep' \"$(which bun)\"\n");
      console.error("  Oder einen anderen Port nehmen:\n");
      console.error("      PORT=3000 bun run start\n");
      process.exit(1);
    }

    if (code === "EADDRINUSE" || /EADDRINUSE|already in use|port \d+ in use/i.test(message)) {
      console.error(`\n  Port ${port} ist schon belegt. Anderen Port wählen: PORT=3000 bun run start\n`);
      process.exit(1);
    }

    throw err;
  }
}

const server = start();

const bootstrap = ensureBootstrapInvite();

console.log(`\n  Maiausfluginator läuft auf ${server.url}`);
console.log(`  Startpunkt aller Messungen: ${HQ.label} (${HQ.lat}, ${HQ.lon})`);
if (bootstrap) {
  console.log(`\n  Noch keine Mitglieder. Erster Admin-Einladungscode:\n\n      ${bootstrap}\n`);
  console.log('  Diesen Code auf der Startseite unter "Einladung einlösen" verwenden.\n');
} else {
  console.log("");
}
