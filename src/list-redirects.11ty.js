module.exports = class {
  data() {
    return { pagination: { data: "listRedirects", size: 1, alias: "redirect" },
      permalink: data => `/lists/${data.redirect.from_id}/`, eleventyExcludeFromCollections: true };
  }
  render({ redirect }) {
    const target = `../${redirect.to_id}/`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>List combined</title>
<link rel="canonical" href="${target}"><script>location.replace(${JSON.stringify(target)} + location.search + location.hash);</script>
<meta http-equiv="refresh" content="0;url=${target}"></head><body><p>This section is now part of the complete list. <a href="${target}">Open the combined list</a>.</p></body></html>`;
  }
};
