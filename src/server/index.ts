import index from "../client/index.html";
import { apiRoutes } from "./api.ts";
import { ensureBootstrapInvite } from "./auth.ts";
import { HQ } from "./geo.ts";
import { seedRestaurants } from "./seed.ts";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);

if (process.env.SKIP_SEED !== "1") seedRestaurants();

const server = Bun.serve({
  port,
  hostname: process.env.HOST ?? "0.0.0.0",
  development: dev,
  // 15 MB: photo uploads are capped at 12 MB plus multipart overhead.
  maxRequestBodySize: 15 * 1024 * 1024,
  routes: {
    ...apiRoutes,
    // Everything else is the single-page app.
    "/*": index,
  },
});

const bootstrap = ensureBootstrapInvite();

console.log(`\n  Maiausfluginator läuft auf ${server.url}`);
console.log(`  Startpunkt aller Messungen: ${HQ.label} (${HQ.lat}, ${HQ.lon})`);
if (bootstrap) {
  console.log(`\n  Noch keine Mitglieder. Erster Admin-Einladungscode:\n\n      ${bootstrap}\n`);
  console.log("  Diesen Code auf der Startseite unter \"Einladung einlösen\" verwenden.\n");
} else {
  console.log("");
}
