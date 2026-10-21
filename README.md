# Lists Explorer

A static website for exploring historical **subscriber lists and donation lists**:
who gave, where they lived, how much, through which agent, and to what cause.

* Data is kept in plain **CSV files** in `data/` — edit them in a spreadsheet.
* The site is built with [Eleventy](https://www.11ty.dev/) and published free on
  **GitHub Pages**. Every push rebuilds it automatically.
* Each list, person, organization, place, agent and source gets its own page
  with a stable, citable address; a search page filters every entry by name,
  place, list, agent, currency and year, and exports results as CSV.

The starter data has two lists: the San Francisco contributors to the Jewish War
Sufferers appeal (*Emanu-El*, 28 January 1916; 919 entries, full transcription, not
yet checked) and a partial draft of the *Committee for the
Relief of the Sufferers at Mogador* list (*The Voice of Jacob*, 3 January 1845).
Check it against the original before relying on it.

## Put it on GitHub

1. Create a new repository on GitHub (e.g. `lists-explorer`). Leave it empty.
2. Upload this folder's contents — either drag the files into the repository's
   web page (“uploading an existing file”), or from a terminal:
   ```
   git init
   git add .
   git commit -m "First version"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/lists-explorer.git
   git push -u origin main
   ```
   Make sure the hidden `.github` folder is included.
3. In the repository go to **Settings › Pages** and set **Source** to **GitHub Actions**.
4. Open the **Actions** tab: the “Build and deploy site” run takes about a minute.
   The site appears at `https://YOUR-NAME.github.io/lists-explorer/`.

After that, any change to `data/` (edited on GitHub or pushed) republishes the site.
If the run fails, open it and read the “npm run build” step: it names the file and
row to fix.

## Adding data

See **[docs/DATA.md](docs/DATA.md)** for every file and column. In short, to add a list:

1. Add the source to `data/sources.csv` (if new) and a row to `data/lists.csv`.
2. Add one row per printed name to `data/entries.csv`.
3. Link names to `people.csv` / `organizations.csv` as you identify them, add
   places to `places.csv`, and officers or receiving banks to `roles.csv`.
4. Put page images in `src/images/` and reference them in the list's `image` column
   (or use a full URL, e.g. from a library's IIIF server).

## Customize

* Site title, credits, licence, GitHub link: `src/_data/site.js`
* Colours and fonts: `src/assets/style.css` (variables at the top)
* Page layouts: `src/**/*.njk`; allowed list types and roles: top of `lib/db.js`

## Work on it locally (optional)

Requires [Node.js](https://nodejs.org/) 20 or later.

```
npm install
npm start          # preview at http://localhost:8080, reloads on change
npm run validate   # check the CSVs only
npm run build      # check + build into _site/
```

## How it scales

All pages are pre-built, so browsing stays fast however much data there is.
The search page loads one JSON index of every entry, which comfortably handles
tens of thousands of entries. If the project grows far beyond that, the index
can be split by list or decade — the rest of the site does not need to change.
