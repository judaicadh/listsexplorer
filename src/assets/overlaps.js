(() => {
  const results = document.getElementById('overlap-results');
  if (!results) return;
  const status = document.getElementById('overlap-status');
  const query = document.getElementById('overlap-query');
  const minimum = document.getElementById('overlap-score');
  const type = document.getElementById('overlap-type');
  const more = document.getElementById('overlap-more');
  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const base = String(window.SITE_BASE || '/').replace(/\/$/, '');
  const url = value => escape(base + value);
  let groups = [], filtered = [], shown = 0;
  function render() {
    const batch = filtered.slice(shown, shown + 25);
    for (const g of batch) {
      const card = document.createElement('details');
      card.className = 'panel overlap-card'; card.id = g.id;
      card.innerHTML = `<summary><strong>${escape(g.name)}</strong> <span class="chip">${g.score}% match confidence</span> <span>${g.listCount} lists · ${g.linked ? 'Existing person record' : 'Full-name candidate'}</span></summary><div class="stack">${g.personUrl ? `<p><a href="${url(g.personUrl)}">Open person record →</a></p>` : ''}${g.rows.map(r => `<section class="overlap-evidence stack"><h3><a href="${url(r.entity_id ? `/people/${r.entity_id}/` : `/people/record/?list=${encodeURIComponent(r.list.id)}&entry=${encodeURIComponent(r.id)}`)}">${escape(r.name)}</a> <span class="chip">${r.reference ? 'Reference record' : `${r.score}% match confidence`}</span></h3><p><a href="${url(r.list.url)}">${escape(r.list.title)}</a> · ${escape(r.list.date)}${r.place ? ` · ${escape(r.place)}` : ''}${r.amount ? ` · ${escape(r.amount)}` : ''}</p><ul>${r.reasons.map(reason => `<li>${escape(reason)}</li>`).join('')}</ul></section>`).join('')}</div>`;
      results.append(card);
    }
    shown += batch.length;
    status.textContent = `${filtered.length.toLocaleString()} matching groups; showing ${shown.toLocaleString()}.`;
    more.hidden = shown >= filtered.length;
  }
  function filter() {
    const q = query.value.toLocaleLowerCase().trim();
    filtered = groups.filter(g => g.score >= Number(minimum.value) && (type.value === 'all' || g.linked === (type.value === 'linked')) && (!q || g.search.includes(q)));
    shown = 0; results.replaceChildren(); render();
    const params = new URLSearchParams();
    if (q) params.set('q', query.value.trim());
    if (minimum.value !== '0') params.set('min', minimum.value);
    if (type.value !== 'all') params.set('type', type.value);
    history.replaceState(null, '', location.pathname + (params.size ? `?${params}` : ''));
  }
  fetch(base + results.dataset.url).then(r => {if (!r.ok) throw Error(r.status); return r.json();}).then(data => {
    groups = data.map(g => ({...g, search: [g.name, ...g.rows.flatMap(r => [r.name, r.place, r.list.title])].join(' ').toLocaleLowerCase()}));
    const params = new URLSearchParams(location.search);
    query.value = params.get('q') || '';
    if ([...minimum.options].some(o => o.value === params.get('min'))) minimum.value = params.get('min');
    if (['all','linked','candidate'].includes(params.get('type'))) type.value = params.get('type');
    document.getElementById('overlap-controls').hidden = false;
    query.addEventListener('input', filter); minimum.addEventListener('change', filter); type.addEventListener('change', filter);
    more.addEventListener('click', render); filter();
  }).catch(() => {status.textContent = 'Search could not load. Showing the first 25 groups; reload to try again.';});
})();
