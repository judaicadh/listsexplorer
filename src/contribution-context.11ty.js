const { context } = require("./assets/contribution");
module.exports = class {
  data() { return { permalink: "/contribution-context.json", eleventyExcludeFromCollections: true }; }
  render({ db }) { return JSON.stringify(context(db)); }
};
