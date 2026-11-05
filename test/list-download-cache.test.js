const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

test("list downloads refresh after replacement even when size and modification time match", () => {
  const root = path.join(__dirname, "..");
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "list-download-cache-"));
  try {
    fs.mkdirSync(path.join(temp, "data"));
    fs.mkdirSync(path.join(temp, "src/assets"), { recursive: true });
    for (const name of ["src/list-downloads.11ty.js", "src/assets/contribution.js"])
      fs.copyFileSync(path.join(root, name), path.join(temp, name));
    fs.symlinkSync(path.join(root, "node_modules"), path.join(temp, "node_modules"), "dir");
    const file = path.join(temp, "data/entries.csv");
    const first = 'id,list_id,seq,name_as_printed,amount\nx,a,1,Alpha,10.00\ny,b,1,Other,20.00\n';
    fs.writeFileSync(file, first);
    const oldTime = new Date(1700000000000);
    fs.utimesSync(file, oldTime, oldTime);
    const Download = require(path.join(temp, "src/list-downloads.11ty.js"));
    const render = id => new Download().render({ list: { id } });
    assert.match(render("a"), /Alpha/);
    assert.doesNotMatch(render("a"), /Other/);
    assert.match(render("b"), /Other/);
    assert.doesNotMatch(render("missing"), /Alpha|Other/);
    const replacement = file + ".next";
    fs.writeFileSync(replacement, first.replace("Alpha", "Bravo"));
    fs.utimesSync(replacement, oldTime, oldTime);
    fs.renameSync(replacement, file);
    assert.match(render("a"), /Bravo/);
    assert.doesNotMatch(render("a"), /Alpha/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
