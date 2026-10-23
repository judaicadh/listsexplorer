// Town-level coordinates already present in the catalogue; no geocoding guesses.
function mapData(db) {
  return {
    types: db.vocab.LIST_TYPES,
    places: db.places.map(p => {
      const linked = new Map();
      const add = (list, origin = false) => {
        if (!list) return null;
        if (!linked.has(list.id)) linked.set(list.id, {id:list.id, title:list.title, url:list.url, type:list.list_type, date:list.dateLabel, entries:0, origin:false});
        const row = linked.get(list.id); row.origin ||= origin; return row;
      };
      p.lists.forEach(l => add(l, true));
      p.entries.forEach(e => { const row = add(e.list); if (row) row.entries++; });
      const lat = String(p.lat ?? '').trim(), lon = String(p.lon ?? '').trim();
      const located = lat !== '' && lon !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lon)) <= 180;
      return { id:p.id, name:p.name, modern:p.modern_name, variants:p.variants, country:p.country || 'Unspecified', url:p.url,
        lat:located?Number(lat):null, lon:located?Number(lon):null, lists:[...linked.values()].sort((a,b)=>a.title.localeCompare(b.title)) };
    }).filter(p => p.lists.length)
  };
}
module.exports = {mapData};
