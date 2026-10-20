module.exports = async function (eleventyConfig) {
  const { HtmlBasePlugin } = await import("@11ty/eleventy");

  // Rewrites links like /lists/ to /<repo-name>/lists/ on GitHub Pages.
  eleventyConfig.addPlugin(HtmlBasePlugin);

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/images": "images" });
  eleventyConfig.addPassthroughCopy({ data: "data" }); // raw CSVs for download
  eleventyConfig.addWatchTarget("data/");
  eleventyConfig.addWatchTarget("lib/");

  eleventyConfig.addFilter("plural", (n, one, many) => `${n} ${n === 1 ? one : many}`);
  eleventyConfig.addFilter("initial", (s) => {
    const m = String(s || "").replace(/^(Messrs\.?|Mr\.?|Mrs\.?|Miss|Sir|Lady|Baron|Baroness|Rev\.?|Dr\.?|The)\s+/i, "").match(/[A-Za-z]/);
    return m ? m[0].toUpperCase() : "#";
  });
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v));

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    pathPrefix: process.env.PATH_PREFIX || "/",
    templateFormats: ["njk", "md", "11ty.js"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
