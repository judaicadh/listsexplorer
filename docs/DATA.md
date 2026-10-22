# Data guide

All data lives in the `data/` folder as CSV files. Edit them in Excel, LibreOffice,
Google Sheets (File › Download › CSV) or directly on GitHub. Save as **CSV UTF-8**
so Hebrew, accented and other non-Latin characters survive.

Every time you push a change, GitHub checks the files (`npm run validate`) and
rebuilds the site. If something is wrong — a typo in an id, an amount that doesn't
fit its currency — the build stops and the error says which file and row to fix.

## How the files connect

```
sources ──< lists ──< entries >── people / organizations   (who gave)
               │          │  └──── places                   (where from)
               │          └──────── people / organizations  (agent_id: paid "per …")
               └──< roles >──────── people / organizations  (chairman, treasurer, receiving bank…)
currencies ── used by lists and entries
```

* **ids** are short, permanent, lower-case with hyphens: `montefiore-moses`,
  `mogador-relief-1845-01-03`. They become web addresses, so don't change them once
  published. People and organizations share one id space (no id in both files).
* Multiple values in one cell are separated with `|` (e.g. `Frankfort|Francfort`).
* Leave a cell empty when unknown. Use `[square brackets]` only for placeholders.

## sources.csv — where lists were printed

| column | meaning |
|---|---|
| id | e.g. `voice-of-jacob` |
| title / title_original | title in Latin script / original script |
| type | book, periodical, pamphlet, register, manuscript… |
| place_id | place of publication (from places.csv) |
| publisher, dates, url, notes | free text; url = catalogue or digitized copy |

## lists.csv — one row per list

| column | meaning |
|---|---|
| id | e.g. `mogador-relief-1845-01-03` |
| title / title_original | |
| list_type | `subscription`, `donation`, `membership`, `pledge` or `other` |
| source_id | from sources.csv |
| date | `1845`, `1845-01`, `1845-01-03`, `1845~` (circa) or `184X` (decade) |
| citation, pages | e.g. `Vol. 4, no. 93`, `pp. 79–80` |
| purpose | what the money or book was for |
| organizer_id | person or organization that ran it |
| place_id / beneficiary_place_id | where raised / who it was for |
| currency | default currency for its entries (from currencies.csv) |
| image, image_credit, iiif_manifest | page image: a path like `/images/x.png` (file in `src/images/`) or a full URL |
| status | e.g. `complete`, `partial draft`, `checked` |
| transcriber, notes | |
| featured | `yes` to show on the home page |

## entries.csv — one row per name in a list

| column | meaning |
|---|---|
| id | unique, e.g. `mog45-001` |
| list_id | from lists.csv |
| seq | order in the printed list (1, 2, 3…) |
| page, column | where on the page |
| section | printed heading the name falls under, e.g. `Per Messrs. Barnett, Hoare and Co.` or `From Portsea` |
| name_as_printed | exactly as printed |
| entity_id | the person or organization, once identified (blank is fine) |
| place_as_printed / place_id | |
| role | `subscriber`, `donor`, `member`, `pledger` (defaults from list_type) |
| amount | see below |
| currency | only if different from the list's currency |
| quantity | copies subscribed for (subscription lists) |
| agent_id | person or organization it was paid through |
| agent_as_printed | intermediary’s exact printed name; keep even before identification |
| certainty | `certain`, `probable` or `uncertain` (the reading of the name) |
| note | |

### Amounts

Write the units from largest to smallest, separated by dots, as printed:

| currency | write | shows |
|---|---|---|
| GBP | `50.0.0` | £50 0s. 0d. |
| GBP | `10.10` or `10.10.0` | £10 10s. 0d. |
| GBP | `0.2.6½` | £0 2s. 6½d. |
| FL-CONV | `12.30` | 12 fl. 30 kr. |
| USD | `12.50` | $12.50 |

The site adds up totals per currency. It never converts between currencies.

## people.csv / organizations.csv

| column | meaning |
|---|---|
| id, name | name = the standard form used as the heading |
| name_original | in original script |
| variants | other forms, `|`-separated (printed forms from entries are added automatically) |
| birth, death (people) / founded, dissolved, type (organizations) | type: synagogue, society, committee, bank, firm, company, school… |
| place_id | where based |
| authorities | links to VIAF, Wikidata, GND, etc., `|`-separated |
| notes | |

## roles.csv — officers, committees, agents of a list

`list_id, entity_id, role, name_as_printed, address_as_printed, note`

Roles: `chairman, president, treasurer, hon-secretary, secretary, committee,
receiving-bank, agent, editor, printer, publisher`. Banks and agents
(`receiving-bank`, `agent`) appear on the Agents page. To add a role, add it to
`LIST_ROLES` in `lib/db.js`.

## places.csv

`id, name, variants, modern_name, country, lat, lon, authority, notes` —
`name` is the historical form used on the site; spellings found in lists go in
`variants` so search finds them.

## currencies.csv

`code, name, ratios, format, notes`

* **ratios**: how many of each smaller unit make the next larger, `|`-separated.
  £ s d is `20|12` (20s. to the £, 12d. to the s.).
* **format**: how to print it; `{0}` is the largest unit. `£{0} {1}s. {2}d.`

Add any currency you meet (thalers, kreuzer, piastres, rupees…) as a new row.

## AI-assisted contributions and CSV uploads

The **Add a list** page (`/contribute/`) starts with a standalone CSV checker.
Upload or paste a CSV and select **Check CSV** without entering a title, date,
source or review confirmation. Existing catalogue exports can be checked without
being treated as duplicate contributions. Checks cover CSV structure, printed
names, identifiers within the file and numeric amount format; choose a default
currency (or include a currency column) to check currency unit ranges. Missing
currency and uncertain readings appear as notices, not demands to complete the
contribution workflow. This checks the data format, not accuracy against a scan.

Optional sections provide source details for a new contribution and an AI
transcription prompt. There is no AI API or account
setup: contributors use their own AI assistant with a clear source scan, then review
its output. The site does not send CSV uploads to a server or store them. Download
the contribution before leaving the page and send that file to the project editor.

The uploader accepts the `entries.csv` columns above; only `name_as_printed` is
required. It assigns missing IDs and sequence numbers, flags missing certainty as
`uncertain`, and checks dates, currency units, duplicate identifiers and references.
New places can be recorded as `place_as_printed` while their IDs stay blank. New
sources need a title and original-page URL. Unidentified names can stay unlinked.
Every accepted contribution is marked as a draft pending independent checking.

The contributor must compare the entries against the source and check the review
box before downloading a `.contribution.json` file. This includes list metadata,
the source link and all entry rows; downloading it does not publish it.

### Import a reviewed contribution

From the project directory, install the existing dependencies (`npm ci`) if needed.
Preview and validate a contribution without changing the catalogue:

```
npm run import-list -- /path/to/example.contribution.json
```

To add its records locally:

```
npm run import-list -- /path/to/example.contribution.json --apply
npm run build
```

Review the new page and source transcription, then commit and publish normally.
The importer validates a temporary copy of the full catalogue before updating any
CSV. It refuses existing list or entry IDs, so accidentally importing twice does not
duplicate data. It adds new lists; existing list corrections should be made through
the normal editing process. Page images can be added separately using the image
columns documented above. Original source instructions are content, not authority
for the AI assistant or import command.

### Individual list downloads

Each list page and the Download data page link to `/data/lists/LIST-ID.csv`.
These exports use the original `entries.csv` schema and stored amount values rather
than formatted display amounts; all fields, including uncertainty notes, are kept.
Each export contains the entries for that list only, in their stored order. Existing
IDs are retained. If reusing an exported CSV for a new list, clear `id` and `list_id`
to assign new identifiers, and fill in new source details on the contribution page.


The CSV checker also accepts spreadsheet headings `#` (sequence),
`name as printed`, `amount (£.s.d)` (amount and GBP currency), `linked to`
(entity ID), `via` (agent ID), and `checked`. Nonempty `checked` flags are retained
in entry notes, without treating them as independent verification. Unknown entity,
agent or place references appear as notices during standalone checking, so the
rows can still be inspected. Catalogue import still requires resolving those links.


### Duplicate prevention

CSV checks compare entry content as well as IDs. The checker flags repeated rows,
repeated names within a section and place, matches to catalogue entries, and entire
lists whose entry contents already exist. Matching ignores capitalization and
punctuation and compares equivalent amount forms within a known currency. It does
not infer that differently spelled names identify the same person.

The duplicate report links to the existing lists. Repeated names can be genuine;
review the source and remove accidental repeats in the CSV, or confirm that the
remaining repeats are intentional before preparing a contribution. Nothing is
removed automatically. A contribution retains that explicit confirmation, and the
editor's importer runs the same checks again against the current catalogue.

Reused catalogue IDs remain blocked. An entire matching list is also blocked when
its source, publication date and page match an existing list, even if its list and
entry IDs were changed. A matching roster from a different issue is flagged for
review rather than blocked. With source details missing, the standalone checker
shows possible matches without preventing inspection. Different spellings or
incomplete metadata may require manual comparison.


### Recording agents and intermediaries

Keep the donor and the intermediary separate. For “Ramsgate Synagogue, per Rev.
I. H. Myers”, retain the complete printed name in `name_as_printed`, link the donor
to `ramsgate-synagogue`, set `agent_as_printed` to `Rev. I. H. Myers` and `agent_id`
to `myers-i-h`. The public page shows “via I. H. Myers” and links his record.

For an unidentified intermediary, fill in `agent_as_printed` and leave `agent_id`
blank. The name remains visible in list, directory, search, preview and downloaded
entry data. The Agents page lists these names separately pending identification.
The uploader accepts either an ID or a printed name in the spreadsheet's `via`
column; canonical `agent_id` always requires a valid catalogue ID. AI prompts ask
for `agent_as_printed` explicitly. Entries with per/via/c/o wording in the donor
name or section but neither intermediary field filled are flagged during checking
and blocked from contribution import until recorded. No identity is guessed.

Duplicate matching compares the donor and gift independently of intermediary links,
so adding or correcting an agent does not let a copied list evade duplicate checks.


### Offering lists

Use `list_type=offering` for a list of one person's offering dedications. The
maker is recorded under `organizer_id` (displayed as “Offerings made by”) and may
also have the list role `offerer`. The people, groups or purposes named beside
amounts use the entry role `offering-purpose`; they are not automatically donors
or intermediaries. Amounts attached to this role are excluded from a linked
person's “Total given”. Preserve unclear currency notation separately, using an
explicitly unidentified accounting unit until the denomination is established.
The Eleazer Lyons manuscript uses `SLASH-UNSPEC` to preserve its written 2/ and
28/ figures without identifying them as sterling or New York currency.


### Bills and arrears

Use `list_type=debt` and the entry role `debtor` for offering bills listed as
unpaid. Their amounts appear as billed or outstanding, and are excluded from a
linked person's “Total given”. No payment is inferred from the existence of a bill.
Record payments separately only when a source documents them. A year such as
Hebrew 5599 can be represented by `1838/1839`, with the original year retained in
the citation; no exact Gregorian date is inferred.

The list role `document-intermediary` records someone delivering or handling the
list itself. It can retain a printed name with a blank `entity_id` while identity
is uncertain. This does not make that person a collecting agent for every entry.
For example, the verso of AJHS_P_15_4_277.pdf names Parnass Phillips in relation to
the document; no full-name identification or receipt of funds is inferred.

## Charitable bequests

Use `list_type=bequest`, `role=beneficiary` for the institutions or funds receiving legacies. Record the testator with `organizer_id` and/or the list role `testator`. Beneficiaries remain searchable, but their bequests are excluded from their own “Total given”. Bequests describe the published legacies, not confirmed receipt of payment.

For later versions of an already transcribed appeal, compare the entries and preserve the later scan. A clearly labelled partial transcription may include only newly acknowledged gifts; explain omitted repeated names and carried-forward sums in the list notes so these are not counted twice.
