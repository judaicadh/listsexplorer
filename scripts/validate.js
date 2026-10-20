#!/usr/bin/env node
// Checks the CSVs in /data before the site is built.
// Errors (broken links between files, bad amounts or dates) stop the build.
// Warnings (e.g. names not yet linked to a person) are listed but allowed.
const { build } = require("../lib/db");

const db = build();
const s = db.stats;
console.log(`Lists: ${s.lists} · entries: ${s.entries} · people: ${s.people} · organizations: ${s.organizations} · places: ${s.places} · sources: ${s.sources}`);

if (db.warnings.length) {
  const show = process.argv.includes("--all-warnings") ? db.warnings : db.warnings.slice(0, 10);
  console.log(`\n${db.warnings.length} warning(s):`);
  show.forEach((w) => console.log("  - " + w));
  if (show.length < db.warnings.length) console.log(`  … ${db.warnings.length - show.length} more (run with --all-warnings)`);
}
if (db.errors.length) {
  console.error(`\n${db.errors.length} error(s) — fix these before publishing:`);
  db.errors.forEach((e) => console.error("  ✗ " + e));
  process.exit(1);
}
console.log("\nData OK.");
