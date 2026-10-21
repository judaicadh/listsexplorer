const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parse: parseCsv } = require('csv-parse/sync');
const api = require('../src/assets/contribution');
const root = path.resolve(__dirname, '..');
const ctx = api.context(require('../lib/db').build());
function sample() { return { version: 1, list: { id: 'test-relief-1855', title: 'Test relief', list_type: 'donation', date: '1855-10-19', source_id: ctx.sources[0].id, currency: 'GBP', notes: 'Original page: https://example.org/scan' }, entries: [{ name_as_printed: 'A. Example', amount: '1.10.6', certainty: 'probable', note: 'Check the initials.' }] }; }

test('CSV preserves commas, doubled quotes, multiline notes and Unicode', () => {
  const rows = [{ name_as_printed: 'Lévy, "A."', note: 'First line\nSecond line\r\nThird line', amount: '0.2.6½' }];
  const text = '\uFEFF' + api.stringify(rows);
  const actual = api.parse(text)[0];
  for (const key of Object.keys(rows[0])) assert.equal(actual[key], rows[0][key]);
  assert.equal(api.parse('name_as_printed\r\nOne\r\n\r\nTwo')[1].name_as_printed, 'Two');
});
test('malformed and ambiguous CSV is rejected without silently dropping data', () => {
  for (const text of ['name_as_printed\n"Unclosed', 'name_as_printed\n"A"oops', 'name_as_printed\nA,B', 'name_as_printed,name_as_printed\nA,B', 'name_as_printed,typo\nA,B', 'name_as_printed']) assert.throws(() => api.parse(text));
});
test('valid contributions normalize rows and retain uncertainty and source notes', () => {
  const input = sample(); input.list.status = 'checked';
  const result = api.validate(input, ctx);
  assert.deepEqual(result.errors, []);
  assert.equal(result.contribution.entries[0].id, 'test-relief-1855-0001');
  assert.equal(result.contribution.entries[0].list_id, input.list.id);
  assert.equal(result.contribution.entries[0].note, 'Check the initials.');
  assert.match(result.contribution.list.status, /draft/);
});
test('unknown currency, reference, duplicate sequence and invalid dates or units block export', () => {
  for (const change of [
    p => p.list.date = '1855-02-29', p => p.list.date = '1855-13',
    p => p.entries[0].amount = '1.20.0', p => p.entries[0].amount = '1.0.12',
    p => p.entries[0].amount = '-1', p => p.entries[0].entity_id = 'invented',
    p => p.entries[0].place_id = 'invented', p => p.entries[0].currency = 'UNKNOWN',
    p => p.entries[0].list_id = 'different', p => p.entries[0].quantity = '1.5',
    p => p.entries.push({...p.entries[0], seq:'1'}),
    p => p.list.id = ctx.lists[0], p => p.list.image = 'javascript:alert(1)',
  ]) {
    const input = sample(); change(input);
    assert.ok(api.validate(input, ctx).errors.length, 'should reject '+JSON.stringify(input));
  }
  const usd = sample(); usd.list.currency = 'USD'; usd.entries[0].amount = '12.50';
  assert.deepEqual(api.validate(usd, ctx).errors, []);
});
test('new sources require a title, matching ID and usable link', () => {
  const p = sample(); p.list.source_id = 'new-source';
  p.source = { id:'new-source', title:'A source', type:'periodical', url:'https://example.org/scan' };
  assert.deepEqual(api.validate(p,ctx).errors,[]);
  p.source.url = 'javascript:alert(1)'; assert.ok(api.validate(p,ctx).errors.length);
});
test('every single-list export round-trips exactly to its original records', () => {
  const raw = parseCsv(fs.readFileSync(path.join(root,'data/entries.csv'),'utf8'),{columns:true,skip_empty_lines:true,bom:true});
  const Export = require('../src/list-downloads.11ty.js');
  for (const id of ctx.lists) {
    const text = new Export().render({list:{id}});
    const actual = parseCsv(text,{columns:true,bom:true,skip_empty_lines:true});
    assert.deepEqual(actual,raw.filter(r=>r.list_id===id));
  }
});
test('import previews without writes, applies validated rows, and refuses repeat or invalid imports', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'lists-import-test-'));
  try {
    for (const name of ['data','lib','scripts']) fs.cpSync(path.join(root,name),path.join(dir,name),{recursive:true});
    fs.mkdirSync(path.join(dir,'src/assets'),{recursive:true});
    fs.copyFileSync(path.join(root,'src/assets/contribution.js'),path.join(dir,'src/assets/contribution.js'));
    fs.symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'),'dir');
    const input = sample(); input.list.source_id = 'test-new-source'; input.source = {id:'test-new-source',title:'Test Source',url:'https://example.org/scan',type:'periodical'};
    input.entries[0].note += '\nMultiline, "quoted"';
    const file = path.join(dir,'input.json'); fs.writeFileSync(file,JSON.stringify(input));
    const run = (...args) => spawnSync(process.execPath,[path.join(dir,'scripts/import-list.js'),file,...args],{encoding:'utf8'});
    const snapshot = () => ['entries','lists','sources'].map(n=>fs.readFileSync(path.join(dir,'data',n+'.csv'),'utf8'));
    const before=snapshot();
    let result=run(); assert.equal(result.status,0,result.stderr); assert.match(result.stdout,/Preview only/); assert.deepEqual(snapshot(),before);
    result=run('--apply'); assert.equal(result.status,0,result.stderr);
    const after=snapshot(); assert.notDeepEqual(after,before);
    const entries=parseCsv(after[0],{columns:true,skip_empty_lines:true});
    assert.equal(entries.at(-1).note,input.entries[0].note);
    assert.equal(entries.at(-1).amount,'1.10.6');
    result=run('--apply'); assert.notEqual(result.status,0); assert.deepEqual(snapshot(),after);
    input.list.id='test-bad'; input.entries[0].amount='oops'; fs.writeFileSync(file,JSON.stringify(input));
    result=run('--apply'); assert.notEqual(result.status,0); assert.deepEqual(snapshot(),after);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});


test('standalone checks need no list metadata and preserve unconfirmed readings', () => {
  const rows = api.parse('name_as_printed,amount\nMiss Jacobs,1.0.0');
  const result = api.checkEntries(rows, ctx);
  assert.deepEqual(result.errors, []);
  assert.equal(result.entries[0].id, '');
  assert.equal(result.entries[0].certainty, '');
  assert.equal(result.entries[0].amount, '1.0.0');
  assert.ok(result.warnings.some(w => /no currency/.test(w)));
  assert.ok(result.warnings.some(w => /unconfirmed/.test(w)));
  assert.ok(api.checkEntries(api.parse('name_as_printed,amount\nA,1.20.0'),ctx,'GBP').errors.length);
  assert.ok(api.checkEntries(api.parse('name_as_printed,amount\nA,oops'),ctx).errors.length);
  assert.ok(api.checkEntries(api.parse('name_as_printed\nA'),ctx,'UNKNOWN').errors.length);
});
test('standalone checks accept existing catalogue exports but catch duplicates within a file', () => {
  const raw = parseCsv(fs.readFileSync(path.join(root,'data/entries.csv'),'utf8'),{columns:true,skip_empty_lines:true,bom:true});
  const existing = raw.filter(e => e.list_id === ctx.lists[0]);
  assert.deepEqual(api.checkEntries(existing,ctx,'GBP').errors, []);
  assert.ok(api.checkEntries([existing[0], existing[0]],ctx,'GBP').errors.length);
  assert.ok(api.validate({version:1,list:{},entries:existing},ctx).errors.length);
});


test('readable spreadsheet headings preserve the supplied Swansea sample', () => {
  const rows = api.parse(fs.readFileSync(path.join(__dirname,'fixtures/swansea-1849.csv'),'utf8'));
  assert.equal(rows.length,43);
  assert.equal(rows[0].seq,'1');
  assert.equal(rows[0].name_as_printed,'The Rev. Dr. Adler');
  assert.equal(rows[0].entity_id,'adler-nathan-marcus');
  assert.equal(rows[0].currency,'GBP');
  assert.equal(rows[15].agent_id,'jewish-chronicle-office');
  assert.equal(rows[26].entity_id,'sichel-a-s');
  assert.equal(rows[42].name_as_printed,'Sundry small Subscriptions');
  const result=api.checkEntries(rows,ctx);
  assert.deepEqual(result.errors,[]);
  assert.ok(result.warnings.some(w=>w.includes('sichel-a-s')));
  assert.ok(result.warnings.some(w=>w.includes('jewish-chronicle-office')));
  const total=rows.reduce((sum,r)=>{const [p,s,d]=r.amount.split('.').map(Number);return sum+p*240+s*12+d;},0);
  assert.equal(total,16710);
});
test('header aliases cannot silently overwrite columns or imply verified readings', () => {
  assert.throws(()=>api.parse('name as printed,name_as_printed\nA,B'),/unique/);
  assert.throws(()=>api.parse('name as printed,amount (£.s.d),currency\nA,1.0.0,USD'),/conflicts/);
  const rows=api.parse('name as printed,note,checked\nA,Check spelling,yes');
  assert.equal(rows[0].certainty,'');
  assert.equal(rows[0].note,'Check spelling\nSpreadsheet review flag: yes');
});
