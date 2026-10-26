// Site-wide settings. Edit the title, tagline and credits here.
module.exports = {
  title: "Lists Explorer",
  tagline: "Subscribers & donors in printed sources",
  description: "A database of historical subscription and donation lists: who gave, where they lived, and how much.",
  creator: "Dr. Laura Newman Eckstein",
  credits: "conceived and created by Dr. Laura Newman Eckstein with the help of AI",
  license: "Data licence: CC BY 4.0",
  repoUrl: "https://github.com/judaicadh/listsexplorer", // e.g. https://github.com/your-name/lists-explorer — shows an “Edit on GitHub” link
  pathPrefix: process.env.PATH_PREFIX || "/",
  builtAt: new Date().toISOString().slice(0, 10),
};
