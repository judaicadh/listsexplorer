const {mapData} = require('../lib/map-data');
module.exports = class {
  data() { return {permalink:'/map-data.json', eleventyExcludeFromCollections:true}; }
  render({db}) { return JSON.stringify(mapData(db)); }
};
