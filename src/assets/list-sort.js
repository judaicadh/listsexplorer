// Catalogue addition time is separate from the historical date of a list.
(function (root) {
  function compare(a, b, order) {
    var title = function () { return a.title.localeCompare(b.title); };
    if (order === 'recent') {
      var aTime = Date.parse(a.added), bTime = Date.parse(b.added);
      if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return bTime - aTime;
      // Append order also covers new catalogue rows that do not yet have a timestamp.
      return b.index - a.index;
    }
    if (order === 'title') return title();
    if (!a.date || !b.date) return a.date ? -1 : b.date ? 1 : title();
    var date = a.date.localeCompare(b.date);
    return (order === 'date-desc' ? -date : date) || title();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { compare: compare };
  if (!root.document) return;
  var select = root.document.querySelector('[data-list-sort]');
  var body = root.document.querySelector('[data-list-rows]');
  if (!select || !body) return;
  var rows = Array.from(body.querySelectorAll('[data-filter-item]'));
  function record(row) {
    return { date: row.dataset.listDate || '', title: row.dataset.listTitle || '', added: row.dataset.listAdded || '', index: Number(row.dataset.listOrder) };
  }
  function sort() {
    rows.sort(function (a, b) { return compare(record(a), record(b), select.value); });
    rows.forEach(function (row) { body.appendChild(row); });
  }
  var allowed = ['date', 'date-desc', 'recent', 'title'];
  function fromUrl() {
    var value = new URL(root.location.href).searchParams.get('sort');
    select.value = allowed.includes(value) ? value : 'date';
    sort();
  }
  select.addEventListener('change', function () {
    sort();
    var url = new URL(root.location.href);
    if (select.value === 'date') url.searchParams.delete('sort');
    else url.searchParams.set('sort', select.value);
    root.history.replaceState(null, '', url);
  });
  root.addEventListener('popstate', fromUrl);
  fromUrl();
})(typeof window === 'undefined' ? {} : window);
