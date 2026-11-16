const {profileMetadata} = require('../lib/profiles');
module.exports = class {
  data() {return {permalink:'/data/profile-metadata.json',eleventyExcludeFromCollections:true};}
  render({db}) {return JSON.stringify(profileMetadata(db));}
};
