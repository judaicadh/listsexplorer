const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { columns, stringify } = require("./assets/contribution");
module.exports = class {
  data() { return { pagination: { data: "db.lists", size: 1, alias: "list" }, permalink: data => `/data/lists/${data.list.id}.csv`, eleventyExcludeFromCollections: true }; }
  render({ list }) {
    const raw = parse(fs.readFileSync(path.join(__dirname, "../data/entries.csv"), "utf8"), { columns: true, skip_empty_lines: true, bom: true });
    return "\uFEFF" + stringify(raw.filter(e => e.list_id === list.id), columns);
  }
};
