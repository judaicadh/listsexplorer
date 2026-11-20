(async () => {
  'use strict';
  const status = document.getElementById('profile-status');
  const content = document.getElementById('profile-content');
  if (!status || !content) return;
  const base = String(window.SITE_BASE || '/').replace(/\/$/, '');
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const href = u => u && u.startsWith('/') && !u.startsWith('//') ? base + u : /^https?:\/\//i.test(u || '') ? u : '';
  const link = (text,url) => href(url) ? `<a href="${esc(href(url))}">${esc(text)}</a>` : esc(text);
  async function load(url, json = true) {const response = await fetch(href(url)); if (!response.ok) throw Error('Source record unavailable'); return json ? response.json() : response.text();}
  try {
    const params = new URLSearchParams(location.search);
    const listId = params.get('list'), entryId = params.get('entry'), via = params.get('via') === '1';
    if (!/^[a-z0-9-]+$/.test(listId || '') || !/^[a-z0-9-]+$/.test(entryId || '')) throw Error('Choose a name from a list or search result to open its profile.');
    const meta = await load('/data/profile-metadata.json');
    const list = meta.lists[listId];
    if (!list) throw Error('This list is not in the current catalogue.');
    let row, roleRecord = list.roles.find(r=>r.id === entryId);
    if (roleRecord && !via) {
      row = {name_as_printed:roleRecord.name, role:roleRecord.role, note:roleRecord.note, address:roleRecord.address, entity_id:roleRecord.entity};
    } else {
      const entries = window.ListContribution.parse(await load(`/data/lists/${listId}.csv`, false));
      row = entries.find(e=>e.id === entryId);
      if (!row || (via && !row.agent_as_printed)) throw Error('This name record could not be found in the list.');
    }
    const name = via ? row.agent_as_printed : row.name_as_printed;
    const entity = meta.entities[via ? row.agent_id : row.entity_id];
    const place = via ? '' : row.place_as_printed || meta.places[row.place_id] || '';
    document.getElementById('profile-name').textContent = name;
    document.title = `${name} — Lists Explorer`;
    status.textContent = entity ? 'This name is linked to an identified catalogue record.' : 'Identity not yet reviewed. This profile preserves one named appearance; matching names elsewhere may be different people. Some name records identify organizations or groups.';
    const currency = meta.currencies[row.currency || list.currency];
    let amount = '';
    if (!via && row.amount) {
      const units = row.amount.split('.');
      amount = currency ? currency.format.replace(/\{(\d)\}/g, (_,n)=>units[n] || '0') : row.amount;
    }
    const field = (label,value) => value ? `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>` : '';
    const sourceUrl = roleRecord ? list.url : `${list.url}#${entryId}`;
    const authoritySection=(title,values)=>{const records=window.ListAuthorities.links(values);return records.length?`<section class="linked-records"><h2 class="h-small">${esc(title)}</h2><span class="authority-links">${records.map(r=>`<a class="authority-link" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.label)}${r.id?` <span class="authority-id">${esc(r.id)}</span>`:''}</a>`).join('')}</span></section>`:'';};
    const authorityHTML=authoritySection('Linked records',entity?.authorities)+(!via?authoritySection('Place reference records',meta.placeAuthorities?.[row.place_id]):'');
    content.innerHTML = `${authorityHTML}${entity ? `<p>${link('Open identified profile: '+entity.name,entity.url)}</p>` : ''}<section class="panel stack"><h2>Recorded appearance</h2><dl class="profile-facts">${field('Name as printed',name)}${field('Date',list.date)+field('Transcription status',list.status)}${field('Role',via ? 'Receiving or forwarding agent' : row.role)}${field('Place',place)}${field('Address',row.address)}${field('Section',row.section)}${field('Page / scan',row.page)}${field('Column',row.column)}${field('Amount as recorded',amount)}${field('Copies / quantity',via ? '' : row.quantity)}${field('Reading certainty',via ? 'Not separately recorded for the intermediary' : row.certainty || 'Not specified')}${field(via ? 'Source-entry notes' : 'Transcription notes',row.note)}</dl><p>${link('View this appearance in the original list',sourceUrl)}</p></section><section class="panel stack"><h2>Source</h2><p>${link(list.title,list.url)} · ${esc(list.date)}</p>${list.source ? `<p>${link(list.source.title,list.source.url)}${list.source.catalogueUrl ? ' · '+link('Archive record',list.source.catalogueUrl) : ''}</p>` : ''}${list.citation ? `<p>${esc(list.citation)}</p>` : ''}${list.images?.length ? `<p>Source scans: ${list.images.map((im,i)=>link(String(i+1),im)).join(' · ')}</p>` : ''}</section><section class="panel stack"><h2>Possible aliases and other appearances</h2><div id="profile-matches" role="status">Checking the current match candidates…</div><p>${link('Search all entries for this name','/search/?q='+encodeURIComponent(name))}</p><p>Confidence percentages are evidence scores, not measured probabilities. These suggestions do not merge profiles.</p></section><section class="panel stack"><h2>Cite or share this profile</h2><p id="profile-citation"></p></section>`;
    document.getElementById('profile-citation').textContent = `“${name}.” Lists Explorer. ${location.href}`;
    content.hidden = false;
    const matches = document.getElementById('profile-matches');
    try {
      const groups = await load('/data/overlaps.json');
      const group = !via && !roleRecord ? groups.find(g=>g.rows.some(r=>r.id===entryId)) : null;
      matches.innerHTML = group ? `<p><strong>${group.score}% match confidence</strong> · ${group.listCount} lists · ${esc(group.name)}</p><p>Printed names: ${esc([...new Set(group.rows.map(r=>r.name))].join(' · '))}</p><p>${link('Compare the names, scores and evidence','/people/overlaps/?q='+encodeURIComponent(group.name))}</p>` : '<p>No match group is available for this record in the current pass. This does not establish that the person appears only once; initials, spelling variants and spousal names may still need review.</p>';
    } catch {matches.textContent = 'Possible matches could not load. Use search to look for other appearances.';}
  } catch(error) { status.textContent = error.message; }
})();
