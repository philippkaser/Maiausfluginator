#!/usr/bin/env bun
/**
 * Mint an invite code from the command line.
 *
 *   bun run invite                 -> normal member
 *   bun run invite --admin         -> admin
 *   bun run invite "Fuer Anna"     -> with a note
 */

import { createInvite } from "../src/server/auth.ts";

const args = process.argv.slice(2);
const grantsAdmin = args.includes("--admin");
const note = args.find((a) => !a.startsWith("--")) ?? null;

const code = createInvite({ createdBy: null, note, grantsAdmin });

console.log(`\n  Einladungscode${grantsAdmin ? " (Admin)" : ""}: ${code}`);
if (note) console.log(`  Notiz: ${note}`);
console.log("");
