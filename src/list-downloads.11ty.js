const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { columns, stringify } = require("./assets/contribution");

// Every paginated download uses the same input. Re-read it when the file changes.
const entriesFile = path.join(__dirname, "../data/entries.csv");
let cachedStamp;
let rowsByList;
function entriesFor(id) {
  const stat = fs.statSync(entriesFile, { bigint: true });
  const stamp = `${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
  if (stamp !== cachedStamp) {
    const raw = parse(fs.readFileSync(entriesFile, "utf8"), { columns: true, skip_empty_lines: true, bom: true });
    const next = new Map();
    for (const row of raw) {
      if (!next.has(row.list_id)) next.set(row.list_id, []);
      next.get(row.list_id).push(row);
    }
    rowsByList = next;
    cachedStamp = stamp;
  }
  return rowsByList.get(id) || [];
}

module.exports = class {
  data() { return { pagination: { data: "db.lists", size: 1, alias: "list" }, permalink: data => `/data/lists/${data.list.id}.csv`, eleventyExcludeFromCollections: true }; }
  render({ list }) {
    return "\uFEFF" + stringify(entriesFor(list.id), columns);
  }
};
