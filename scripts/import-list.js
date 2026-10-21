#!/usr/bin/env node
// Preview by default; --apply appends validated records to the catalogue.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { parse } = require("csv-parse/sync");
const api = require("../src/assets/contribution");
const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2), file = args.find(a => !a.startsWith("--"));
if (!file || args.some(a => a.startsWith("--") && a !== "--apply")) {
  console.error("Usage: npm run import-list -- contribution.json [--apply]"); process.exit(1);
}
let stage;
try {
  const stat = fs.statSync(file);
  if (stat.size > 20 * 1024 * 1024) throw new Error("Contribution files must be smaller than 20 MB.");
  const db = require("../lib/db").build();
  if (db.errors.length) throw new Error("Fix the current catalogue before importing:\n" + db.errors.join("\n"));
  const result = api.validate(JSON.parse(fs.readFileSync(file, "utf8")), api.context(db));
  if (result.errors.length) throw new Error(result.errors.join("\n"));
  const { list, source, entries } = result.contribution;
  stage = fs.mkdtempSync(path.join(os.tmpdir(), "lists-import-"));
  fs.cpSync(path.join(root, "data"), path.join(stage, "data"), { recursive: true });
  const updates = { lists: [list], entries, ...(source ? { sources: [source] } : {}) };
  const contents = new Map();
  for (const [table, rows] of Object.entries(updates)) {
    const target = path.join(root, "data", table + ".csv");
    const original = fs.readFileSync(target, "utf8");
    const fields = parse(original, { to: 1, bom: true })[0];
    const newline = (original.match(/\r\n|\n|\r/) || ["\n"])[0];
    const encoded = api.stringify(rows, fields, newline);
    const appended = encoded.slice(encoded.indexOf(newline) + newline.length);
    const next = original + (original.endsWith("\n") ? "" : "\n") + appended;
    contents.set(target, { original, next });
    fs.writeFileSync(path.join(stage, "data", table + ".csv"), next);
  }
  // Load the real catalogue validator against the staged data, using the project's dependencies.
  const Module = require("node:module");
  const filename = path.join(stage, "lib", "db.js");
  const stagedModule = new Module(filename, module);
  stagedModule.filename = filename; stagedModule.paths = module.paths;
  stagedModule._compile(fs.readFileSync(path.join(root, "lib", "db.js"), "utf8"), filename);
  const checked = stagedModule.exports.build();
  if (checked.errors.length) throw new Error(checked.errors.join("\n"));
  const added = checked.lists.find(l => l.id === list.id);
  console.log(`Ready: ${list.title} (${list.id}) — ${entries.length} entries.`);
  console.log("Totals: " + (added.totals.map(t => t.display).join("; ") || "no amounts"));
  if (!args.includes("--apply")) console.log("Preview only. Run again with --apply to save this draft. Then build and review before publishing.");
  else {
    for (const [target, { original }] of contents) if (fs.readFileSync(target, "utf8") !== original) throw new Error("Catalogue changed during import; please retry.");
    const written = [];
    try {
      for (const [target, { next }] of contents) { fs.writeFileSync(target, next); written.push(target); }
    } catch (error) {
      for (const target of written) fs.writeFileSync(target, contents.get(target).original);
      throw error;
    }
    console.log("Saved as a contributed draft. Run npm run build, review the result, and publish through the usual process.");
  }
} catch (error) { console.error("Import stopped: " + error.message); process.exitCode = 1; }
finally { if (stage) fs.rmSync(stage, { recursive: true, force: true }); }
