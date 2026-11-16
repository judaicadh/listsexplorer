module.exports = class {
  data() { return {permalink: '/data/overlaps.json', eleventyExcludeFromCollections: true}; }
  render(data) { return JSON.stringify(data.db.overlaps); }
};
