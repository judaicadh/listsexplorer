// Loads every CSV in /data, checks the links between them, and builds the
// joined model the site templates use. Used by both the site build
// (src/_data/db.js) and `npm run validate` (scripts/validate.js).

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const DATA_DIR = path.join(__dirname, "..", "data");

// Controlled vocabularies. Add values here as the project grows.
const LIST_TYPES = {
  subscription: "Subscriber list",
  donation: "Donation list",
  membership: "Membership list",
  pledge: "Pledge list",
  other: "Other list",
  offering: "Offering list",
  debt: "Offering bills / arrears",
  bequest: "Charitable bequests",
  agents: "List of agents",
  petition: "Petition / requisition",
};
const ENTRY_ROLES = {
  subscriber: "Subscriber",
  donor: "Donor",
  member: "Member",
  pledger: "Pledger",
  "offering-purpose": "Offering dedication / purpose",
  debtor: "Person billed / debtor",
  beneficiary: "Bequest recipient",
  agent: "Agent",
  officer: "Officer",
  signatory: "Signatory",
};
const LIST_ROLES = {
  chairman: "Chairman",
  president: "President",
  treasurer: "Treasurer",
  "hon-secretary": "Hon. secretary",
  secretary: "Secretary",
  committee: "Committee member",
  steward: "Steward",
  "receiving-bank": "Receiving bank",
  agent: "Collecting agent",
  editor: "Editor",
  printer: "Printer",
  publisher: "Publisher",
  offerer: "Offerings made by",
  testator: "Bequests made by",
  addressee: "Document addressee",
  respondent: "Reply signed by",
  "document-intermediary": "Document intermediary",
};
const AGENT_ROLES = new Set(["receiving-bank", "agent"]);
const CERTAINTY = new Set(["", "certain", "probable", "uncertain"]);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

function readCsv(name) {
  const file = path.join(DATA_DIR, name + ".csv");
  if (!fs.existsSync(file)) return [];
  return parse(fs.readFileSync(file, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  });
}

function splitList(s) {
  return String(s || "").split("|").map((x) => x.trim()).filter(Boolean);
}

// ---- Dates (ISO / EDTF-style: 1845, 1845-01, 1845-01-03, 1845~, 184X) ----
function yearOf(date) {
  const m = String(date || "").match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
}
function formatDate(date) {
  const d = String(date || "").trim();
  if (/^\d{4}\/\d{4}$/.test(d)) return d.replace("/", "–");
  let m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  m = d.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  if (/^\d{4}~$/.test(d)) return `c. ${d.slice(0, 4)}`;
  if (/^\d{3}X$/.test(d)) return `${d.slice(0, 3)}0s`;
  return d;
}
function validDate(date) {
  return date === "" || /^(\d{4}(-\d{2}(-\d{2})?)?[~?]?|\d{3}X)(\/(\d{4}(-\d{2}(-\d{2})?)?))?$/.test(date);
}

// ---- Money ----
// Amounts are written as their units from largest to smallest, separated by
// dots: "50.0.0" is £50 0s. 0d.; "12.30" is 12 fl. 30 kr. Missing smaller
// units count as 0 ("25" = £25 0s. 0d.). The last unit may end in ½ ¼ ¾.
const FRACTIONS = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };
function unitValue(s) {
  s = String(s).trim();
  let frac = 0;
  for (const [k, v] of Object.entries(FRACTIONS)) {
    if (s.endsWith(k)) { frac = v; s = s.slice(0, -k.length); break; }
  }
  if (s === "") return frac;
  return /^\d+$/.test(s) ? Number(s) + frac : NaN;
}
// 10000 -> 10,000 (largest unit only)
function group(s) {
  return /^\d{4,}$/.test(s) ? Number(s).toLocaleString("en-US") : s;
}
function parseAmount(raw, currency) {
  if (raw === "" || raw == null) return null;
  const ratios = currency.ratioList;
  const parts = String(raw).split(".");
  if (parts.length > ratios.length + 1) return { error: `has more units than ${currency.code} allows` };
  const values = parts.map(unitValue);
  if (values.some(Number.isNaN)) return { error: "is not a number" };
  while (values.length < ratios.length + 1) { values.push(0); parts.push("0"); }
  // value in the smallest unit
  let base = values[0];
  for (let i = 0; i < ratios.length; i++) base = base * ratios[i] + values[i + 1];
  const shown = parts.slice();
  shown[0] = group(shown[0]);
  const display = currency.format.replace(/\{(\d)\}/g, (_, i) => shown[i] ?? "0");
  return { base, display, parts };
}
function formatBase(base, currency) {
  // turn a smallest-unit total back into units (for list totals)
  const ratios = currency.ratioList;
  const parts = [];
  let rest = base;
  for (let i = ratios.length - 1; i >= 0; i--) {
    const v = rest % ratios[i];
    parts.unshift(Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));
    rest = Math.floor(rest / ratios[i]);
  }
  parts.unshift(group(String(rest)));
  return currency.format.replace(/\{(\d)\}/g, (_, i) => parts[i] ?? "0");
}

function sortName(s) {
  return String(s || "")
    .replace(/^(Messrs\.?|Mr\.?|Mrs\.?|Miss|Sir|Lady|Baron|Baroness|Rev\.?|Dr\.?|The)\s+/i, "")
    .toLowerCase();
}

function build() {
  const errors = [];
  const warnings = [];
  const err = (file, row, msg) => errors.push(`${file}.csv row ${row}: ${msg}`);
  const warn = (file, row, msg) => warnings.push(`${file}.csv row ${row}: ${msg}`);

  function indexById(name, rows) {
    const map = new Map();
    rows.forEach((r, i) => {
      if (!r.id) return err(name, i + 2, "missing id");
      if (!/^[a-z0-9][a-z0-9-]*$/.test(r.id)) err(name, i + 2, `id "${r.id}" should use only lower-case letters, digits and hyphens`);
      if (map.has(r.id)) err(name, i + 2, `duplicate id "${r.id}"`);
      map.set(r.id, r);
    });
    return map;
  }

  // ---- raw tables ----
  const currencies = readCsv("currencies").map((c) => ({
    ...c,
    ratioList: splitList(c.ratios).map(Number),
  }));
  const currencyMap = new Map();
  currencies.forEach((c, i) => {
    if (!c.code) return err("currencies", i + 2, "missing code");
    if (!c.format) err("currencies", i + 2, `${c.code} has no format`);
    if (c.ratioList.some((n) => !(n > 0))) err("currencies", i + 2, `${c.code} has a bad ratio`);
    currencyMap.set(c.code, c);
  });

  const places = readCsv("places").map((p) => ({
    ...p,
    kind: "place",
    url: `/places/${p.id}/`,
    variants: splitList(p.variants),
    lat: p.lat ? Number(p.lat) : null,
    lon: p.lon ? Number(p.lon) : null,
  }));
  const placeMap = indexById("places", places);

  const people = readCsv("people").map((p) => ({
    ...p,
    kind: "person",
    url: `/people/${p.id}/`,
    variants: splitList(p.variants),
    authorities: splitList(p.authorities),
  }));
  const organizations = readCsv("organizations").map((o) => ({
    ...o,
    kind: "organization",
    url: `/organizations/${o.id}/`,
    variants: splitList(o.variants),
    authorities: splitList(o.authorities),
  }));
  const peopleMap = indexById("people", people);
  const orgMap = indexById("organizations", organizations);
  const entityMap = new Map([...peopleMap, ...orgMap]);
  for (const id of peopleMap.keys()) if (orgMap.has(id)) errors.push(`id "${id}" is used in both people.csv and organizations.csv`);

  const sources = readCsv("sources").map((s) => ({ ...s, kind: "source", catalogueUrl: s.url, url: `/sources/${s.id}/` }));
  const sourceMap = indexById("sources", sources);

  const lists = readCsv("lists").map((l) => ({ ...l, kind: "list", url: `/lists/${l.id}/` }));
  const listMap = indexById("lists", lists);

  const roles = readCsv("roles");
  const entries = readCsv("entries");
  indexById("entries", entries);

  const ref = (map, file, row, field, id) => {
    if (!id) return null;
    const hit = map.get(id);
    if (!hit) err(file, row, `${field} "${id}" not found`);
    return hit || null;
  };

  // ---- link places, entities ----
  [...people, ...organizations].forEach((e) => {
    const file = e.kind === "person" ? "people" : "organizations";
    e.place = ref(placeMap, file, "?", "place_id", e.place_id);
    e.sortKey = sortName(e.name);
    e.entries = [];
    e.roles = [];
    e.agentEntries = [];
    e.lists = new Set();
  });
  places.forEach((p) => { p.entries = []; p.lists = []; p.entities = []; });
  [...people, ...organizations].forEach((e) => { if (e.place) e.place.entities.push(e); });

  // ---- sources & lists ----
  sources.forEach((s, i) => {
    s.place = ref(placeMap, "sources", i + 2, "place_id", s.place_id);
    s.lists = [];
    if (!s.title) err("sources", i + 2, "missing title");
  });
  lists.forEach((l, i) => {
    const row = i + 2;
    if (!l.title) err("lists", row, "missing title");
    if (!LIST_TYPES[l.list_type]) err("lists", row, `list_type "${l.list_type}" is not one of: ${Object.keys(LIST_TYPES).join(", ")}`);
    if (!validDate(l.date || "")) err("lists", row, `date "${l.date}" should look like 1845, 1845-01 or 1845-01-03`);
    l.typeLabel = LIST_TYPES[l.list_type] || l.list_type;
    l.images = splitList(l.image); // one or more page images, |-separated
    l.year = yearOf(l.date);
    l.dateLabel = formatDate(l.date);
    l.source = ref(sourceMap, "lists", row, "source_id", l.source_id);
    l.organizer = ref(entityMap, "lists", row, "organizer_id", l.organizer_id);
    l.place = ref(placeMap, "lists", row, "place_id", l.place_id);
    l.beneficiaryPlace = ref(placeMap, "lists", row, "beneficiary_place_id", l.beneficiary_place_id);
    l.currency = ref(currencyMap, "lists", row, "currency", l.currency);
    l.entries = [];
    l.roles = [];
    if (l.source) l.source.lists.push(l);
    if (l.place) l.place.lists.push(l);
    if (l.organizer) l.organizer.lists.add(l);
  });

  // ---- roles (officers, committees, receiving banks, agents) ----
  roles.forEach((r, i) => {
    const row = i + 2;
    r.list = ref(listMap, "roles", row, "list_id", r.list_id);
    r.entity = ref(entityMap, "roles", row, "entity_id", r.entity_id);
    if (!LIST_ROLES[r.role]) err("roles", row, `role "${r.role}" is not one of: ${Object.keys(LIST_ROLES).join(", ")}`);
    r.roleLabel = LIST_ROLES[r.role] || r.role;
    r.isAgent = AGENT_ROLES.has(r.role);
    r.displayName = r.name_as_printed || (r.entity && r.entity.name) || "";
    if (r.list) r.list.roles.push(r);
    if (r.entity) { r.entity.roles.push(r); if (r.list) r.entity.lists.add(r.list); }
  });

  // ---- entries ----
  entries.forEach((e, i) => {
    const row = i + 2;
    e.list = ref(listMap, "entries", row, "list_id", e.list_id);
    if (!e.list_id) err("entries", row, "missing list_id");
    if (!e.name_as_printed) err("entries", row, "missing name_as_printed");
    e.entity = ref(entityMap, "entries", row, "entity_id", e.entity_id);
    e.place = ref(placeMap, "entries", row, "place_id", e.place_id);
    e.agent = ref(entityMap, "entries", row, "agent_id", e.agent_id);
    e.agentLabel = e.agent ? e.agent.name : e.agent_as_printed || "";
    e.role = e.role || (e.list && e.list.list_type === "subscription" ? "subscriber" : e.list && e.list.list_type === "offering" ? "offering-purpose" : e.list && e.list.list_type === "debt" ? "debtor" : e.list && e.list.list_type === "petition" ? "signatory" : e.list && e.list.list_type === "agents" ? "agent" : e.list && e.list.list_type === "bequest" ? "beneficiary" : "donor");
    if (!ENTRY_ROLES[e.role]) err("entries", row, `role "${e.role}" is not one of: ${Object.keys(ENTRY_ROLES).join(", ")}`);
    e.roleLabel = ENTRY_ROLES[e.role] || e.role;
    if (!CERTAINTY.has(e.certainty || "")) err("entries", row, `certainty "${e.certainty}" should be certain, probable or uncertain`);
    e.seqNum = Number(e.seq) || 0;
    const curCode = e.currency || (e.list && e.list.currency && e.list.currency.code);
    e.currencyObj = curCode ? currencyMap.get(curCode) : null;
    if (e.currency && !e.currencyObj) err("entries", row, `currency "${e.currency}" not found in currencies.csv`);
    e.money = null;
    if (e.amount) {
      if (!e.currencyObj) err("entries", row, "has an amount but no currency (set it on the entry or the list)");
      else {
        const m = parseAmount(e.amount, e.currencyObj);
        if (m && m.error) err("entries", row, `amount "${e.amount}" ${m.error}`);
        else e.money = m;
      }
    }
    e.quantityNum = e.quantity ? Number(e.quantity) : null;
    if (e.quantity && Number.isNaN(e.quantityNum)) err("entries", row, `quantity "${e.quantity}" is not a number`);
    e.displayName = e.entity ? e.entity.name : e.name_as_printed;
    e.amountLabel = e.money ? e.money.display : (e.quantityNum ? `${e.quantityNum} ${e.quantityNum === 1 ? "copy" : "copies"}` : "");
    if (!e.entity_id) warn("entries", row, `"${e.name_as_printed}" is not linked to a person or organization yet`);

    if (e.list) e.list.entries.push(e);
    if (e.entity) { e.entity.entries.push(e); if (e.list) e.entity.lists.add(e.list); }
    if (e.agent) { e.agent.agentEntries.push(e); if (e.list) e.agent.lists.add(e.list); }
    if (e.place) e.place.entries.push(e);
  });

  // ---- per-list summaries ----
  function totals(entryList) {
    const by = new Map();
    for (const e of entryList) {
      if (!e.money) continue;
      const c = e.currencyObj;
      const t = by.get(c.code) || { currency: c, base: 0, count: 0 };
      t.base += e.money.base; t.count++;
      by.set(c.code, t);
    }
    return [...by.values()].map((t) => ({ code: t.currency.code, name: t.currency.name, count: t.count, display: formatBase(t.base, t.currency) }));
  }

  lists.forEach((l) => {
    l.entries.sort((a, b) => a.seqNum - b.seqNum);
    l.totals = totals(l.entries);
    const withMoney = l.entries.filter((e) => e.money);
    const top = withMoney.slice().sort((a, b) => b.money.base - a.money.base).slice(0, 10);
    const max = top.length ? top[0].money.base : 1;
    l.topGifts = top.map((e) => ({ entry: e, pct: Math.max(1, Math.round((e.money.base / max) * 100)) }));
    // group by printed section, keeping order of first appearance
    const sections = [];
    const seen = new Map();
    for (const e of l.entries) {
      const key = e.section || "";
      if (!seen.has(key)) { const s = { title: key, entries: [] }; seen.set(key, s); sections.push(s); }
      seen.get(key).entries.push(e);
    }
    sections.forEach((s) => { s.totals = totals(s.entries); });
    l.sections = sections;
    l.officers = l.roles.filter((r) => !r.isAgent);
    l.agents = l.roles.filter((r) => r.isAgent);
    l.placeCount = new Set(l.entries.map((e) => e.place_id).filter(Boolean)).size;
    // entries per place, for the "By place" chart
    const pc = new Map();
    for (const e of l.entries) if (e.place) pc.set(e.place, (pc.get(e.place) || 0) + 1);
    const pmax = Math.max(1, ...pc.values());
    l.byPlace = [...pc.entries()].sort((a, b) => b[1] - a[1]).map(([place, n]) => ({ place, n, pct: Math.max(1, Math.round((n / pmax) * 100)) }));
    // copies subscribed (one copy unless a quantity is printed)
    l.copies = l.list_type === "subscription" ? l.entries.reduce((s, e) => s + (e.quantityNum || 1), 0) : null;
  });

  // ---- per-entity summaries ----
  const entities = [...people, ...organizations];
  entities.forEach((e) => {
    e.entries.sort((a, b) => (a.list?.year || 0) - (b.list?.year || 0) || a.seqNum - b.seqNum);
    e.lists = [...e.lists].sort((a, b) => (a.year || 0) - (b.year || 0));
    e.totals = totals(e.entries.filter(entry => !["offering-purpose", "debtor", "beneficiary", "officer", "agent", "signatory"].includes(entry.role)));
    e.agentTotals = totals(e.agentEntries);
    e.isAgent = e.agentEntries.length > 0 || e.entries.some(entry => entry.role === "agent") || e.roles.some((r) => r.isAgent);
    e.years = [...new Set(e.lists.map((l) => l.year).filter(Boolean))].sort();
    e.printedForms = [...new Set([e.name, ...e.variants, ...e.entries.map((x) => x.name_as_printed), ...e.roles.map((r) => r.name_as_printed)].filter(Boolean))];
  });
  people.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  organizations.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  places.sort((a, b) => a.name.localeCompare(b.name));
  places.forEach((p) => { p.lists.sort((a, b) => (a.year || 0) - (b.year || 0)); });
  lists.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  sources.sort((a, b) => a.title.localeCompare(b.title));

  const unlinked = new Map();
  for (const entry of entries) {
    if (entry.agent || !entry.agent_as_printed) continue;
    if (!unlinked.has(entry.agent_as_printed)) unlinked.set(entry.agent_as_printed, { name: entry.agent_as_printed, entries: [], lists: new Map() });
    const item = unlinked.get(entry.agent_as_printed); item.entries.push(entry);
    if (entry.list) item.lists.set(entry.list.id, entry.list);
  }
  const unlinkedAgents = [...unlinked.values()].map(a => ({ ...a, lists: [...a.lists.values()] }));

  const listed = new Map();
  for (const entry of entries.filter(e => e.role === "agent")) {
    const key = JSON.stringify([entry.entity_id || entry.name_as_printed, entry.place_id || entry.place_as_printed]);
    if (!listed.has(key)) listed.set(key, { name: entry.name_as_printed, entity: entry.entity, place: entry.place, place_as_printed: entry.place_as_printed, entries: [] });
    listed.get(key).entries.push(entry);
  }
  const listedAgents = [...listed.values()];

  const years = lists.map((l) => l.year).filter(Boolean);
  const stats = {
    lists: lists.length,
    entries: entries.length,
    people: people.length,
    organizations: organizations.length,
    places: places.filter((p) => p.entries.length || p.lists.length || p.entities.length).length,
    sources: sources.length,
    currencies: new Set(entries.map((e) => e.currencyObj && e.currencyObj.code).filter(Boolean)).size,
    yearFrom: years.length ? Math.min(...years) : null,
    yearTo: years.length ? Math.max(...years) : null,
  };

  return {
    errors, warnings, stats,
    lists, sources, people, organizations, places, currencies, roles, entries,
    agents: entities.filter((e) => e.isAgent).sort((a, b) => a.sortKey.localeCompare(b.sortKey)),
    unlinkedAgents, listedAgents,
    featuredLists: lists.filter((l) => l.featured === "yes"),
    vocab: { LIST_TYPES, ENTRY_ROLES, LIST_ROLES },
  };
}

module.exports = { build, parseAmount, formatBase, formatDate, yearOf };
