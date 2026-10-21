// Builds /search-index.json: one compact row per entry for the search page.
class SearchIndex {
  data() {
    return { permalink: "/search-index.json", eleventyExcludeFromCollections: true };
  }
  render({ db }) {
    const rows = db.entries.map((e) => ({
      id: e.id,
      n: e.name_as_printed,
      e: e.entity ? e.entity.name : "",
      eu: e.entity ? e.entity.url : "",
      ek: e.entity ? e.entity.kind : "",
      l: e.list ? e.list.title : "",
      lu: e.list ? e.list.url : "",
      t: e.list ? e.list.list_type : "",
      y: e.list ? e.list.year : null,
      p: e.place ? e.place.name : e.place_as_printed || "",
      pu: e.place ? e.place.url : "",
      g: e.agentLabel || "",
      gu: e.agent ? e.agent.url : "",
      gp: e.agent_as_printed || "",
      s: e.section || "",
      r: e.roleLabel,
      a: e.amountLabel,
      v: e.money ? e.money.base : null,
      c: e.currencyObj && e.money ? e.currencyObj.code : "",
      q: e.quantityNum,
      x: e.certainty || "",
      // extra text that should match a search: variants of names and places
      k: [
        ...(e.entity ? e.entity.variants : []),
        ...(e.place ? e.place.variants : []),
        ...(e.agent ? e.agent.variants : []),
        e.agent_as_printed,
        e.place && e.place.modern_name,
      ].filter(Boolean).join(" "),
    }));
    return JSON.stringify({
      built: new Date().toISOString(),
      types: db.vocab.LIST_TYPES,
      currencies: Object.fromEntries(db.currencies.map((c) => [c.code, c.name])),
      rows,
    });
  }
}
module.exports = SearchIndex;
