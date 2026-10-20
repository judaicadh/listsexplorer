const { build } = require("../../lib/db");

module.exports = function () {
  const db = build();
  if (db.errors.length) {
    throw new Error("Data errors:\n" + db.errors.join("\n") + "\nRun `npm run validate` for details.");
  }
  return db;
};
