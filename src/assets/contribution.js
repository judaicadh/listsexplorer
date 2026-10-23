/* Shared by the browser review screen and the maintainer's import command. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ListContribution = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const columns = "id,list_id,seq,page,column,section,name_as_printed,entity_id,place_as_printed,place_id,role,amount,currency,quantity,agent_id,certainty,note,agent_as_printed".split(",");
  const listColumns = "id,title,title_original,list_type,source_id,date,citation,pages,purpose,organizer_id,place_id,beneficiary_place_id,currency,image,image_credit,iiif_manifest,status,transcriber,featured,notes".split(",");
  const sourceColumns = "id,title,title_original,type,place_id,publisher,dates,url,notes".split(",");
  const slug = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90).replace(/-$/, "");
  function stringify(rows, fields = columns, newline = "\r\n") {
    const cell = v => { const s = String(v == null ? "" : v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return fields.map(cell).join(",") + newline + rows.map(r => fields.map(f => cell(r[f])).join(",")).join(newline) + (rows.length ? newline : "");
  }
  function parse(text) {
    text = String(text).replace(/^\uFEFF/, "");
    if (text.length > 5 * 1024 * 1024) throw new Error("Use a CSV smaller than 5 MB.");
    const records = []; let row = [], field = "", state = "plain";
    function endRow() { row.push(field); if (row.some(v => v.trim())) records.push(row); row = []; field = ""; }
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (state === "quoted") {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else state = "closed"; }
        else field += c;
      } else if (c === ",") { row.push(field); field = ""; state = "plain"; }
      else if (c === "\r" || c === "\n") { endRow(); state = "plain"; if (c === "\r" && text[i + 1] === "\n") i++; }
      else if (c === '"' && state === "plain" && !field) state = "quoted";
      else { if (state === "closed" || c === '"') throw new Error("Unexpected text or quote in CSV row " + (records.length + 1) + ". Check the quoting."); field += c; }
    }
    if (state === "quoted") throw new Error("A quoted CSV field is missing its closing quote.");
    endRow();
    if (records.length < 2) throw new Error("Include a header and at least one entry.");
    const aliases = { "#": "seq", "linked_to": "entity_id", "via": "agent_id", "amount_(£.s.d)": "amount" };
    const printedHeaders = records.shift().map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
    const pounds = printedHeaders.includes("amount_(£.s.d)");
    const header = printedHeaders.map(h => aliases[h] || h);
    if (new Set(header).size !== header.length) throw new Error("CSV headers must be unique.");
    const unknown = header.filter(h => !columns.includes(h) && h !== "checked");
    if (unknown.length) throw new Error("Unknown columns: " + unknown.join(", ") + ". Use the template's column names.");
    if (!header.includes("name_as_printed")) throw new Error("The CSV needs a name_as_printed column.");
    if (records.length > 20000) throw new Error("Please split lists larger than 20,000 entries.");
    return records.map((values, i) => {
      if (values.length !== header.length) throw new Error("CSV row " + (i + 2) + " has " + values.length + " fields; expected " + header.length + ".");
      const entry = Object.fromEntries(columns.map(c => [c, header.includes(c) ? values[header.indexOf(c)].trim() : ""]));
      if (pounds) {
        if (entry.currency && entry.currency !== "GBP") throw new Error("CSV row " + (i + 2) + ": currency conflicts with the pounds/shillings/pence amount heading.");
        entry.currency = "GBP";
      }
      if (printedHeaders.includes("via") && entry.agent_id && !/^[a-z0-9][a-z0-9-]*$/.test(entry.agent_id)) {
        if (entry.agent_as_printed && entry.agent_as_printed !== entry.agent_id) throw new Error("CSV row " + (i + 2) + ": via and agent_as_printed disagree.");
        entry.agent_as_printed = entry.agent_id; entry.agent_id = "";
      }
      const checked = header.includes("checked") ? values[header.indexOf("checked")].trim() : "";
      if (checked) entry.note = [entry.note, "Spreadsheet review flag: " + checked].filter(Boolean).join("\n");
      return entry;
    });
  }
  const normalized = s => String(s || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  function rowKey(e, currency, ctx) {
    const code = e.currency || currency || "";
    const cur = ctx.currencies.find(c => c.code === code);
    let amount = String(e.amount || "").trim();
    if (amount && cur) {
      const fractions = { "½": .5, "¼": .25, "¾": .75, "⅓": 1 / 3, "⅔": 2 / 3 };
      const parts = amount.split(".").map(p => Number(p.replace(/[½¼¾⅓⅔]/g, "")) + (fractions[p.slice(-1)] || 0));
      while (parts.length < cur.ratios.length + 1) parts.push(0);
      amount = String(parts.reduce((sum, n, i) => i ? sum * cur.ratios[i - 1] + n : n, 0));
    }
    const place = ctx.places.find(p => p.id === e.place_id);
    return JSON.stringify([normalized(e.name_as_printed), normalized(place ? place.name : e.place_as_printed), normalized(e.section), amount, code, String(e.quantity || "")]);
  }
  function findDuplicates(entries, ctx, list = {}) {
    const groups = new Map(), names = new Map(), catalogue = new Map(), byList = new Map();
    for (const row of ctx.catalogueRows || []) {
      if (!catalogue.has(row.key)) catalogue.set(row.key, []);
      catalogue.get(row.key).push(row);
      if (!byList.has(row.list_id)) byList.set(row.list_id, []);
      byList.get(row.list_id).push(row.key);
    }
    const existing = [], keys = entries.map(e => rowKey(e, list.currency, ctx));
    entries.forEach((e, i) => {
      if (!normalized(e.name_as_printed)) return;
      const key = keys[i];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(i + 1);
      const name = JSON.stringify([normalized(e.name_as_printed), normalized(e.section), normalized(e.place_as_printed || e.place_id)]);
      if (!names.has(name)) names.set(name, []);
      names.get(name).push(i + 1);
      const matches = catalogue.get(key);
      if (matches) existing.push({ row: i + 1, name: e.name_as_printed, matches: matches.slice(0, 5) });
    });
    const repeated = [...groups.values()].filter(rows => rows.length > 1).map(rows => ({ rows, name: entries[rows[0] - 1].name_as_printed, exact: true }));
    for (const rows of names.values()) if (rows.length > 1 && new Set(rows.map(n => keys[n - 1])).size > 1) repeated.push({ rows, name: entries[rows[0] - 1].name_as_printed, exact: false });
    const signature = JSON.stringify(keys.slice().sort());
    const wholeLists = entries.length === 0 ? [] : [...byList].filter(([, values]) => values.length === entries.length && JSON.stringify(values.slice().sort()) === signature).map(([id]) => {
      const known = (ctx.listDetails || []).find(l => l.id === id) || { id, title: id };
      const sourceTitle = list.source_title || (ctx.sources.find(s => s.id === list.source_id) || {}).title;
      const sameSource = list.source_id === known.source_id || (sourceTitle && normalized(sourceTitle) === normalized(known.source_title));
      const samePage = list.pages && known.pages && normalized(list.pages) === normalized(known.pages);
      return { ...known, blocked: Boolean(sameSource && list.date && list.date === known.date && samePage) };
    });
    return { repeated, existing, wholeLists, needsReview: Boolean(repeated.length || existing.length || wholeLists.length) };
  }
  function context(db) {
    const ctx = {
      lists: db.lists.map(l => l.id), entries: db.entries.map(e => e.id),
      sources: db.sources.map(s => ({ id: s.id, title: s.title })),
      places: db.places.map(p => ({ id: p.id, name: p.name })),
      entities: [...db.people, ...db.organizations].map(e => e.id),
      entityLabels: Object.fromEntries([...db.people, ...db.organizations].map(e => [e.id, { name: e.name, url: e.url }])),
      currencies: db.currencies.map(c => ({ code: c.code, name: c.name, ratios: c.ratioList })),
    };
    ctx.listDetails = db.lists.map(l => ({ id: l.id, title: l.title, date: l.date, source_id: l.source_id, source_title: l.source ? l.source.title : "", pages: l.pages }));
    ctx.catalogueRows = db.entries.map(e => ({ id: e.id, list_id: e.list_id, key: rowKey(e, e.list && e.list.currency ? e.list.currency.code : "", ctx) }));
    return ctx;
  }
  function validate(input, ctx, entriesOnly = false) {
    const errors = [];
    const clean = (obj, fields) => Object.fromEntries(fields.map(f => [f, String(obj && obj[f] != null ? obj[f] : "").trim()]));
    if (!input || input.version !== 1 || !input.list || !Array.isArray(input.entries)) throw new Error("This is not a Lists Explorer contribution (version 1).");
    const list = clean(input.list, listColumns);
    const source = input.source ? clean(input.source, sourceColumns) : null;
    const idOK = id => /^[a-z0-9][a-z0-9-]{0,99}$/.test(id);
    const has = (rows, id, key = "id") => rows.some(r => (typeof r === "string" ? r : r[key]) === id);
    const http = s => /^https?:\/\/[^\s]+$/i.test(s);
    if (!entriesOnly) {
      if (!idOK(list.id) || list.id.length > 90) errors.push("Use a list ID with lower-case letters, numbers and hyphens (up to 90 characters).");
      if (has(ctx.lists, list.id)) errors.push("This list ID already exists. Choose a new ID for a new list.");
      if (!list.title) errors.push("Enter a list title.");
      if (!["subscription", "donation", "membership", "pledge", "other", "offering", "debt", "bequest", "agents", "petition", "prize", "sport", "roster"].includes(list.list_type)) errors.push("Choose a list type.");
      const dates = list.date.split("/");
      if (dates.length > 2 || dates.some(d => !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(d))) errors.push("Enter YYYY, YYYY-MM, YYYY-MM-DD or a year range such as 1838/1839.");
      else {
        for (const date of dates) {
          const [y, m, d] = date.split("-").map(Number);
          if ((m !== undefined && (m < 1 || m > 12)) || (d !== undefined && (d < 1 || d > new Date(Date.UTC(y, m, 0)).getUTCDate()))) errors.push("The list date is not a valid calendar date.");
        }
        if (dates.length === 2 && dates[0] > dates[1]) errors.push("The end of the date range must not precede the start.");
      }
      if (source) {
        if (!idOK(source.id) || source.id !== list.source_id) errors.push("The new source ID must match the list's source ID.");
        if (has(ctx.sources, source.id)) errors.push("This source ID exists. Select the existing source instead.");
        if (!source.title || !http(source.url)) errors.push("A new source needs a title and an http or https source link.");
        if (source.place_id && !has(ctx.places, source.place_id)) errors.push("Unknown source place ID: " + source.place_id);
      } else if (!has(ctx.sources, list.source_id)) errors.push("Select an existing source or enter a new one.");
      if (list.currency && !has(ctx.currencies, list.currency, "code")) errors.push("Choose a known currency.");
      for (const key of ["place_id", "beneficiary_place_id"]) if (list[key] && !has(ctx.places, list[key])) errors.push("Unknown " + key + ": " + list[key]);
      if (list.organizer_id && !has(ctx.entities, list.organizer_id)) errors.push("Unknown organizer ID.");
      if (list.image && list.image.split("|").some(s => !http(s))) errors.push("Use full http or https links for page images.");
      if (list.iiif_manifest && !http(list.iiif_manifest)) errors.push("Use an http or https IIIF link.");
    }
    if (!input.entries.length || input.entries.length > 20000) errors.push("Include between 1 and 20,000 entries.");
    const ids = new Set(entriesOnly ? [] : ctx.entries), seqs = new Set();
    const entries = input.entries.map((raw, i) => {
      const e = clean(raw, columns), label = "Entry " + (i + 1) + ": ";
      if (!entriesOnly) {
        e.id = e.id || list.id + "-" + String(i + 1).padStart(4, "0");
        if (e.list_id && e.list_id !== list.id) errors.push(label + "list_id must match " + list.id + ".");
        e.list_id = list.id; e.seq = e.seq || String(i + 1);
        e.role = e.role || (list.list_type === "subscription" ? "subscriber" : list.list_type === "membership" ? "member" : list.list_type === "pledge" ? "pledger" : list.list_type === "offering" ? "offering-purpose" : list.list_type === "debt" ? "debtor" : list.list_type === "bequest" ? "beneficiary" : list.list_type === "prize" ? "prize-recipient" : ["sport", "roster"].includes(list.list_type) ? "participant" : list.list_type === "petition" ? "signatory" : list.list_type === "agents" ? "agent" : "donor");
        e.certainty = e.certainty || "uncertain";
      }
      if (e.id && (!idOK(e.id) || ids.has(e.id))) errors.push(label + "entry ID is invalid or already used: " + e.id);
      ids.add(e.id);
      if (e.seq && (!/^[1-9]\d*$/.test(e.seq) || seqs.has(e.seq))) errors.push(label + "sequence numbers must be positive and unique.");
      if (e.seq) seqs.add(e.seq);
      if (!e.name_as_printed) errors.push(label + "a printed name is required.");
      if (e.role && !["donor", "subscriber", "member", "pledger", "offering-purpose", "debtor", "beneficiary", "agent", "officer", "signatory", "prize-recipient", "participant"].includes(e.role)) errors.push(label + "unknown role.");
      if (e.certainty && !["certain", "probable", "uncertain"].includes(e.certainty)) errors.push(label + "certainty must be certain, probable or uncertain.");
      for (const key of ["entity_id", "agent_id"]) if (!entriesOnly && e[key] && !has(ctx.entities, e[key])) errors.push(label + "unknown " + key + ": " + e[key] + ". Leave unidentified names unlinked.");
      if (!entriesOnly && e.place_id && !has(ctx.places, e.place_id)) errors.push(label + "unknown place_id. Use place_as_printed for a place not yet in the directory.");
      if (e.quantity && !/^[1-9]\d*$/.test(e.quantity)) errors.push(label + "quantity must be a positive whole number.");
      const currency = ctx.currencies.find(c => c.code === (e.currency || list.currency));
      if (e.currency && !currency) errors.push(label + "unknown currency.");
      if (e.amount) {
        if (!currency) {
          if (!entriesOnly) errors.push(label + "select a currency for this amount.");
          else if (!/^\d+(?:\.\d+)*[½¼¾⅓⅔]?$/.test(e.amount)) errors.push(label + "amount must use numeric units separated by dots.");
        }
        else {
          const parts = e.amount.split(".");
          if (parts.length > currency.ratios.length + 1 || parts.some((p, n) => !(n === parts.length - 1 ? /^\d+[½¼¾⅓⅔]?$/ : /^\d+$/).test(p)) || parts.some((p, n) => n > 0 && parseFloat(p) >= currency.ratios[n - 1])) errors.push(label + "invalid amount for " + currency.code + ". Use unit-separated values such as 1.10.6 for GBP, or 12.50 for USD.");
        }
      }
      if (!entriesOnly && /(?:\bper\s+|\bvia\s+|\bc\/o\s+)/i.test([e.name_as_printed, e.section].join(" ")) && !e.agent_id && !e.agent_as_printed) errors.push(label + "an intermediary is printed here. Record the name in agent_as_printed or link agent_id before importing.");
      return e;
    });
    // Every contribution enters the catalogue as a draft, even after a contributor reviews it.
    list.status = "contributed draft — not independently checked"; list.featured = "";
    const duplicates = entriesOnly ? null : findDuplicates(entries, ctx, { ...list, source_title: source && source.title });
    if (duplicates) {
      for (const known of duplicates.wholeLists.filter(l => l.blocked)) errors.push("This list's entries already exist in “" + known.title + "” for the same source and date. Use the existing list instead of importing it again.");
      if (duplicates.needsReview && input.duplicate_reviewed !== true) errors.push("Review the possible duplicates and confirm which repeated entries are intentional before preparing this contribution.");
    }
    return { errors, duplicates, contribution: { version: 1, list, source, entries, duplicate_reviewed: input.duplicate_reviewed === true } };
  }
  function checkEntries(entries, ctx, currency = "") {
    const result = validate({ version: 1, list: { currency }, entries }, ctx, true);
    const warnings = [];
    if (currency && !ctx.currencies.some(c => c.code === currency)) result.errors.push("Choose a known default currency.");
    if (entries.some(e => e.amount && !e.currency && !currency)) warnings.push("Some amounts have no currency. Their unit ranges have not been checked; choose a default currency to check them.");
    entries.forEach((e, index) => {
      if (/(?:\bper\s+|\bvia\s+|\bc\/o\s+)/i.test([e.name_as_printed, e.section].join(" ")) && !e.agent_id && !e.agent_as_printed) warnings.push("Entry " + (index + 1) + ": intermediary wording is present. Record the printed name in agent_as_printed or link an agent_id before importing.");
      for (const key of ["entity_id", "agent_id"]) if (e[key] && !ctx.entities.includes(e[key])) warnings.push("Entry " + (index + 1) + ": " + key + " “" + e[key] + "” is not in the catalogue yet; retained for review before importing.");
      if (e.place_id && !ctx.places.some(p => p.id === e.place_id)) warnings.push("Entry " + (index + 1) + ": place_id “" + e.place_id + "” is not in the catalogue yet; retained for review before importing.");
    });
    const uncertain = entries.filter(e => e.certainty !== "certain").length;
    if (uncertain) warnings.push(uncertain + (uncertain === 1 ? " entry has an uncertain or unconfirmed reading." : " entries have uncertain or unconfirmed readings.") + " A CSV check cannot verify the transcription against the source.");
    const duplicates = findDuplicates(result.contribution.entries, ctx, { currency });
    return { errors: result.errors, warnings, entries: result.contribution.entries, duplicates };
  }
  return { columns, listColumns, sourceColumns, parse, stringify, slug, context, validate, checkEntries, findDuplicates };
});
