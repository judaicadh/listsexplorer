// Evidence scores are transparent review aids, not calibrated probabilities.
function normalize(name) {
  return String(name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/^(?:(?:mr|miss|lady|rev|revd|dr|sir|rabbi|hon|baron|lieut|col)\.?\s+)+/i, '')
    .replace(/\b(?:esq|jp|mp)\.?\b/gi, '').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}
function eligible(name) {
  if (/\b(mrs|madame|mme)\b/i.test(name)) return false; // Spousal names require separate review.
  if (/[&?\[\]\d]/.test(name) || /\b(company|co|bros|brothers|sons|society|association|congregation|committee|school|family|anonymous|friend|cash|balance|total|heirs|estate|children|fund|bank|lodge|library|the)\b/i.test(name)) return false;
  const tokens = normalize(name).split(' ');
  return tokens.length >= 2 && tokens.length <= 5 && tokens.every(t => /^[a-z-]{2,}$/.test(t));
}
function scoreMatch(anchor, row) {
  const reasons = [];
  const linked = !!anchor.entity_id && anchor.entity_id === row.entity_id;
  const sameName = normalize(anchor.name) === normalize(row.name);
  let score = linked ? 80 : sameName ? 65 : 40;
  reasons.push(linked ? 'Already linked to this person in the catalogue (+80 base); this link has not been independently verified here.' : sameName ? 'Same full name after removing titles and punctuation (+65 base).' : 'Matches a recorded name variant (+40 base); needs review.');
  if (anchor.place_id && anchor.place_id === row.place_id) { score += 10; reasons.push('Same explicitly recorded place (+10).'); }
  const gap = anchor.year && row.year ? Math.abs(anchor.year - row.year) : null;
  if (gap !== null && gap <= 30) { score += 5; reasons.push('List dates within 30 years (+5); compatible dates alone do not establish identity.'); }
  if ([anchor, row].some(r => ['uncertain', 'probable'].includes(r.certainty))) { score -= 15; reasons.push('At least one transcription is uncertain or probable (−15).'); }
  if ([anchor, row].some(r => /\b(com|company|co|family|sons|brothers)\b|&/i.test(r.name))) { score = Math.min(score, 60); reasons.push('A name includes a company or collective attribution (score capped at 60%).'); }
  if (gap !== null && gap > 60) { score = Math.min(score, 25); reasons.push('More than 60 years between records: possible namesakes (capped at 25%).'); }
  if (anchor.entity_id && row.entity_id && anchor.entity_id !== row.entity_id) { score = Math.min(score, 20); reasons.push('Different existing person records: conflicting identity links (capped at 20%).'); }
  return {score: Math.max(0, Math.min(95, score)), reasons};
}
function buildOverlaps(people, entries) {
  const personMap = new Map(people.map(p => [p.id, p]));
  const aliases = new Map();
  for (const p of people) for (const form of [p.name, ...p.variants, ...p.entries.map(e => e.name_as_printed)]) {
    if (!eligible(form)) continue;
    const key = normalize(form);
    if (!aliases.has(key)) aliases.set(key, new Set());
    aliases.get(key).add(p.id);
  }
  const buckets = new Map();
  for (const e of entries) {
    if (!e.list || (e.entity && e.entity.kind !== 'person')) continue;
    let entityId = e.entity?.kind === 'person' && personMap.has(e.entity.id) ? e.entity.id : (personMap.has(e.entity_id) ? e.entity_id : '');
    if (!entityId && !eligible(e.name_as_printed)) continue;
    const key = normalize(e.name_as_printed);
    if (!entityId && aliases.get(key)?.size === 1) entityId = [...aliases.get(key)][0];
    const bucketKey = entityId ? `person-${entityId}` : `name-${key}`;
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, {id: bucketKey, person: personMap.get(entityId), rows: []});
    buckets.get(bucketKey).rows.push({id: e.id, name: e.name_as_printed, entity_id: entityId || e.entity_id, place_id: e.place_id, place: e.place?.name || e.place_as_printed || '', year: e.list.year, certainty: e.certainty, list: {id: e.list.id, title: e.list.title, url: e.list.url, date: e.list.dateLabel}, amount: e.amountLabel});
  }
  const result = [];
  for (const b of buckets.values()) {
    const count = new Set(b.rows.map(r => r.list.id)).size;
    if (count < 2) continue;
    b.rows.sort((a, c) => Number(!!c.entity_id) - Number(!!a.entity_id) || Number(!!a.certainty && a.certainty !== 'certain') - Number(!!c.certainty && c.certainty !== 'certain') || (a.year || 0) - (c.year || 0));
    const anchor = b.rows[0];
    const rows = b.rows.map((r, i) => ({...r, reference: i === 0, ...(i ? scoreMatch(anchor, r) : {score: null, reasons: ['Reference record used for comparison.']})}));
    const candidates = rows.filter(r => !r.reference && r.list.id !== anchor.list.id);
    const score = Math.min(...candidates.map(r => r.score));
    result.push({id: b.id, name: b.person?.name || anchor.name, personUrl: b.person?.url || '', linked: !!b.person, listCount: count, score, rows});
  }
  return result.sort((a,b) => Number(b.linked)-Number(a.linked) || b.score-a.score || b.listCount-a.listCount || a.name.localeCompare(b.name));
}
module.exports = {normalize, eligible, scoreMatch, buildOverlaps};
