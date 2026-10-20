// Site-wide settings. Edit the title, tagline and credits here.
module.exports = {
  title: "Lists Explorer",
  tagline: "Subscribers & donors in printed sources",
  description: "A database of historical subscription and donation lists: who gave, where they lived, and how much.",
  credits: "[Project name / institution]",
  license: "Data licence: [e.g. CC BY 4.0]",
  repoUrl: "", // e.g. https://github.com/your-name/lists-explorer — shows an “Edit on GitHub” link
  pathPrefix: process.env.PATH_PREFIX || "/",
  builtAt: new Date().toISOString().slice(0, 10),
};
