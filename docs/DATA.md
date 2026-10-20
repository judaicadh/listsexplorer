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
