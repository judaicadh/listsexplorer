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
    input.entries[0].agent_as_printed='Rev. Unidentified Intermediary';
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
    assert.equal(entries.at(-1).agent_as_printed,'Rev. Unidentified Intermediary');
    const importedDb=require(path.join(dir,'lib/db.js')).build();
    assert.ok(importedDb.unlinkedAgents.some(a=>a.name==='Rev. Unidentified Intermediary'&&a.entries.length===1));
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
  const unresolved={...ctx,entities:ctx.entities.filter(id=>!['sichel-a-s','jewish-chronicle-office'].includes(id))};
  const result=api.checkEntries(rows,unresolved);
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

test('duplicate rows are found with missing IDs and equivalent amount spellings', () => {
  const rows=api.parse('name_as_printed,amount,currency\n"A. Example",1,GBP\n"a example",1.0.0,GBP');
  const result=api.checkEntries(rows,ctx);
  assert.deepEqual(result.errors,[]);
  assert.equal(result.duplicates.repeated.length,1);
  assert.deepEqual(result.duplicates.repeated[0].rows,[1,2]);
  assert.equal(result.duplicates.repeated[0].exact,true);
  const contribution=sample(); contribution.entries=rows;
  assert.ok(api.validate(contribution,ctx).errors.some(e=>/Review the possible duplicates/.test(e)));
  contribution.duplicate_reviewed=true;
  assert.deepEqual(api.validate(contribution,ctx).errors,[]);
});
test('same names with different gifts need review without merging their rows', () => {
  const rows=api.parse('name_as_printed,amount,currency,section\nA,1,GBP,London\nA,2,GBP,London\nA,1,GBP,Paris');
  const result=api.checkEntries(rows,ctx);
  assert.deepEqual(result.duplicates.repeated.map(g=>g.rows),[[1,2]]);
  assert.equal(result.duplicates.repeated[0].exact,false);
  assert.equal(result.entries.length,3);
});
function existingBrussaCopy() {
  const lists=parseCsv(fs.readFileSync(path.join(root,'data/lists.csv'),'utf8'),{columns:true,skip_empty_lines:true});
  const list={...lists.find(l=>l.id==='brussa-relief-1855-10-19'),id:'brussa-copy',image:'',iiif_manifest:''};
  const entries=parseCsv(fs.readFileSync(path.join(root,'data/entries.csv'),'utf8'),{columns:true,skip_empty_lines:true}).filter(e=>e.list_id==='brussa-relief-1855-10-19').map(e=>({...e,id:'',list_id:''}));
  return {version:1,list,entries,duplicate_reviewed:true};
}
test('an entire existing roster is found after removing IDs and reordering entries', () => {
  const input=existingBrussaCopy(); input.entries.reverse();
  input.entries.forEach(e=>{e.seq='';e.note='New transcription';});
  const result=api.validate(input,ctx);
  assert.ok(result.errors.some(e=>/already exist/.test(e)));
  assert.ok(result.duplicates.wholeLists.some(l=>l.id==='brussa-relief-1855-10-19'&&l.blocked));
  assert.equal(api.checkEntries(input.entries,ctx,'GBP').duplicates.existing.length,24);
  input.entries[0]={...input.entries[1]};
  assert.equal(api.findDuplicates(input.entries,ctx,input.list).wholeLists.length,0,'multiplicity must be compared, not just unique names');
});
test('a matching roster from a different issue is reviewable, not automatically blocked', () => {
  const input=existingBrussaCopy(); input.list.date='1855-10-26';
  let result=api.validate(input,ctx);
  assert.deepEqual(result.errors,[]);
  assert.ok(result.duplicates.wholeLists.length);
  assert.ok(result.duplicates.wholeLists.every(l=>!l.blocked));
  input.duplicate_reviewed=false;
  assert.ok(api.validate(input,ctx).errors.some(e=>/Review the possible duplicates/.test(e)));
  input.list.date='1855-10-19';input.list.pages='';input.duplicate_reviewed=true;
  result=api.validate(input,ctx);assert.deepEqual(result.errors,[],'without a page locator, request review rather than assume the same source location');
});
test('the importer rejects renamed duplicate lists and leaves the catalogue unchanged', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lists-dupes-test-'));
  try {
    for(const name of ['data','lib','scripts'])fs.cpSync(path.join(root,name),path.join(dir,name),{recursive:true});
    fs.mkdirSync(path.join(dir,'src/assets'),{recursive:true});
    fs.copyFileSync(path.join(root,'src/assets/contribution.js'),path.join(dir,'src/assets/contribution.js'));
    fs.symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'),'dir');
    const file=path.join(dir,'input.json');fs.writeFileSync(file,JSON.stringify(existingBrussaCopy()));
    const before=['entries','lists','sources'].map(n=>fs.readFileSync(path.join(dir,'data',n+'.csv'),'utf8'));
    const result=spawnSync(process.execPath,[path.join(dir,'scripts/import-list.js'),file,'--apply'],{encoding:'utf8'});
    assert.notEqual(result.status,0);assert.match(result.stderr,/already exist/);
    assert.deepEqual(['entries','lists','sources'].map(n=>fs.readFileSync(path.join(dir,'data',n+'.csv'),'utf8')),before);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('the Ramsgate donation records Myers as intermediary, separately from the donor',()=>{
  const db=require('../lib/db').build();
  const e=db.entries.find(e=>e.id==='brussa55-006');
  assert.equal(e.entity.id,'ramsgate-synagogue');
  assert.equal(e.agent.id,'myers-i-h');
  assert.equal(e.agent_as_printed,'Rev. I. H. Myers');
  assert.equal(e.agentLabel,'I. H. Myers');
  assert.equal(e.agent.entries.length,0);
  assert.ok(e.agent.agentEntries.includes(e));
  assert.ok(db.agents.includes(e.agent));
  const Search=require('../src/search-index.11ty.js');
  const result=JSON.parse(new Search().render({db})).rows.find(r=>r.id===e.id);
  assert.equal(result.g,'I. H. Myers');assert.equal(result.gp,'Rev. I. H. Myers');
  const Export=require('../src/list-downloads.11ty.js');
  const row=api.parse(new Export().render({list:{id:e.list_id}})).find(r=>r.id===e.id);
  assert.equal(row.agent_id,'myers-i-h');assert.equal(row.agent_as_printed,'Rev. I. H. Myers');
});
test('printed intermediary names survive CSV parsing before an entity is identified',()=>{
  const rows=api.parse('name as printed,via\nExample donor,Rev. U. Example');
  assert.equal(rows[0].agent_id,'');assert.equal(rows[0].agent_as_printed,'Rev. U. Example');
  const input=sample();input.entries=rows;
  const result=api.validate(input,ctx);assert.deepEqual(result.errors,[]);
  assert.equal(result.contribution.entries[0].agent_as_printed,'Rev. U. Example');
  assert.throws(()=>api.parse('name_as_printed,via,agent_as_printed\nA,Rev. A,Rev. B'),/disagree/);
});
test('unrecorded per wording is flagged and cannot be silently imported',()=>{
  const input=sample();input.entries[0].name_as_printed='Example donor, per Rev. U. Example';
  assert.ok(api.checkEntries(input.entries,ctx,'GBP').warnings.some(w=>/intermediary wording/.test(w)));
  assert.ok(api.validate(input,ctx).errors.some(e=>/intermediary is printed/.test(e)));
  input.entries[0].agent_as_printed='Rev. U. Example';
  assert.deepEqual(api.validate(input,ctx).errors,[]);
});
test('new intermediary text cannot disguise an otherwise duplicate list',()=>{
  const input=existingBrussaCopy();input.entries.forEach(e=>{e.agent_id='';e.agent_as_printed='New agent wording';});
  assert.ok(api.validate(input,ctx).errors.some(e=>/already exist/.test(e)));
});
test('section headings do not hide the via link on a list page',()=>{
  const nj=require('nunjucks');const env=new nj.Environment(new nj.FileSystemLoader(path.join(root,'src/_includes')));
  const db=require('../lib/db').build();const list=db.lists.find(l=>l.id==='brussa-relief-1855-10-19');
  const entry=list.entries.find(e=>e.agent_id==='myers-i-h');
  const output=env.renderString(fs.readFileSync(path.join(root,'src/lists/list.njk'),'utf8'),{list:{...list,sections:[{title:'Ramsgate',entries:[entry]}]},site:{}});
  assert.match(output,/via <a href="\/people\/myers-i-h\/">I\. H\. Myers<\/a>/);
});

test('Lyons manuscript is an offering-purpose list with literal unidentified units',()=>{
  const db=require('../lib/db').build();const list=db.lists.find(l=>l.id==='eleazer-lyons-offerings-1818-11-07');
  assert.equal(list.date,'1818-11-07');assert.equal(list.typeLabel,'Offering list');assert.equal(list.entries.length,9);
  assert.equal(list.organizer.id,'lyons-eleazer');assert.ok(list.roles.some(r=>r.role==='offerer'));
  assert.ok(list.entries.every(e=>e.role==='offering-purpose'&&!e.agent_id));
  assert.equal(list.currency.code,'SLASH-UNSPEC');assert.deepEqual(list.currency.ratioList,[]);
  assert.equal(list.totals[0].display,'44/ (unit unidentified)');
  assert.equal(list.entries.filter(e=>e.amount==='2').length,8);assert.equal(list.entries.find(e=>e.seq==='4').amount,'28');
  assert.equal(list.source.catalogueUrl,'/images/ajhs-p15-3-161-eleazer-lyons-offerings.pdf');
  assert.notEqual(list.source.url,list.source.catalogueUrl);
});
test('offering purposes are accepted by the contributor and import validators',()=>{
  const p=sample();p.list.list_type='offering';p.entries[0].role='';
  const result=api.validate(p,ctx);assert.deepEqual(result.errors,[]);
  assert.equal(result.contribution.entries[0].role,'offering-purpose');
});
test('an offering honouree is not counted as a donor in personal totals',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lists-offering-test-'));
  try{
    fs.cpSync(path.join(root,'data'),path.join(dir,'data'),{recursive:true});
    fs.cpSync(path.join(root,'lib'),path.join(dir,'lib'),{recursive:true});
    fs.symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'),'dir');
    const file=path.join(dir,'data/entries.csv');const rows=parseCsv(fs.readFileSync(file,'utf8'),{columns:true,skip_empty_lines:true});
    const e=rows.find(e=>e.id==='lyons1818-001');e.entity_id='lyons-eleazer';
    fs.writeFileSync(file,api.stringify(rows));
    const db=require(path.join(dir,'lib/db')).build();assert.deepEqual(db.errors,[]);
    const person=db.people.find(p=>p.id==='lyons-eleazer');assert.equal(person.entries.length,1);assert.deepEqual(person.totals,[]);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('offering bills are unpaid accounts, not received donations',()=>{
  const db=require('../lib/db').build();const list=db.lists.find(l=>l.id==='offering-bills-unpaid-5599');
  assert.equal(list.entries.length,25);assert.equal(list.list_type,'debt');assert.equal(list.date,'1838/1839');assert.equal(list.dateLabel,'1838–1839');
  assert.ok(list.entries.every(e=>e.role==='debtor'&&!e.agent_id));
  assert.equal(list.totals[0].display,'$127.88');
  assert.equal(list.entries[1].place_id,'savannah');assert.equal(list.entries[6].place_id,'liverpool');
  const role=list.roles.find(r=>r.role==='document-intermediary');
  assert.equal(role.displayName,'Parnass Phillips');assert.equal(role.entity,null);assert.equal(role.isAgent,false);
  const Search=require('../src/search-index.11ty.js');
  const rows=JSON.parse(new Search().render({db})).rows.filter(r=>r.t==='debt');
  assert.ok(rows.every(r=>r.r==='Person billed / debtor'));
});
test('date ranges and debtor defaults are accepted without inventing an exact day',()=>{
  const input=sample();input.list.list_type='debt';input.list.date='1838/1839';input.entries[0].role='';
  let result=api.validate(input,ctx);assert.deepEqual(result.errors,[]);assert.equal(result.contribution.entries[0].role,'debtor');
  for(const date of ['1839/1838','1838/','1838/1839/1840','1839-02-29/1839-03-01']){
    input.list.date=date;assert.ok(api.validate(input,ctx).errors.length,date);
  }
  input.list.date='1840-02-29/1840-03-01';assert.deepEqual(api.validate(input,ctx).errors,[]);
});
test('an identified debtor does not acquire a misleading total given',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lists-debtor-test-'));
  try{
    fs.cpSync(path.join(root,'data'),path.join(dir,'data'),{recursive:true});
    fs.cpSync(path.join(root,'lib'),path.join(dir,'lib'),{recursive:true});
    fs.symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'),'dir');
    const file=path.join(dir,'data/entries.csv');const rows=parseCsv(fs.readFileSync(file,'utf8'),{columns:true,skip_empty_lines:true});
    rows.find(e=>e.id==='bills5599-001').entity_id='lyons-eleazer';fs.writeFileSync(file,api.stringify(rows));
    const db=require(path.join(dir,'lib/db')).build();assert.deepEqual(db.errors,[]);
    const person=db.people.find(p=>p.id==='lyons-eleazer');assert.equal(person.entries.length,1);assert.deepEqual(person.totals,[]);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('bill pages label arrears and keep the document role separate',()=>{
  const nj=require('nunjucks');const env=new nj.Environment(new nj.FileSystemLoader(path.join(root,'src/_includes')));
  const db=require('../lib/db').build();const list=db.lists.find(l=>l.id==='offering-bills-unpaid-5599');
  const html=env.renderString(fs.readFileSync(path.join(root,'src/lists/list.njk'),'utf8'),{list,site:{}});
  assert.match(html,/Total listed as unpaid/);assert.match(html,/Largest unpaid bills/);assert.match(html,/Document handling/);
  assert.match(html,/Person billed as written/);assert.match(html,/Parnass Phillips/);assert.doesNotMatch(html,/via Parnass Phillips/);
});

test('November bequests preserve recipients without crediting them as donors',()=>{
  const db=require('../lib/db').build();assert.deepEqual(db.errors,[]);
  const list=db.lists.find(l=>l.id==='morris-emanuel-bequests-1849-11-30');
  assert.equal(list.entries.length,23);assert.equal(list.totals[0].display,'£500 0s. 0d.');
  assert.ok(list.entries.every(e=>e.role==='beneficiary'));
  assert.equal(list.roles.find(r=>r.role==='testator').displayName,'the late Mr. Morris Emanuel');
  const org=db.organizations.find(o=>o.id==='great-synagogue-dukes-place');
  const amounts=org.entries.filter(e=>e.role==='beneficiary');assert.equal(amounts.length,1);
  const without=org.entries.filter(e=>!['offering-purpose','debtor','beneficiary'].includes(e.role));
  assert.equal(org.totals.reduce((n,t)=>n+t.count,0),without.filter(e=>e.money).length);
  const input=sample();input.list.list_type='bequest';input.entries[0].role='';
  const result=api.validate(input,ctx);assert.deepEqual(result.errors,[]);assert.equal(result.contribution.entries[0].role,'beneficiary');
  const nj=require('nunjucks');const env=new nj.Environment(new nj.FileSystemLoader(path.join(root,'src/_includes')));
  const html=env.renderString(fs.readFileSync(path.join(root,'src/lists/list.njk'),'utf8'),{list,site:{}});
  assert.match(html,/Recipient as printed/);assert.match(html,/Total bequeathed/);
});
test('Brower donations keep receiving agents, nested collectors and unpriced clothing',()=>{
  const db=require('../lib/db').build();const list=db.lists.find(l=>l.id==='isaac-brower-relief-1849-11-30');
  assert.equal(list.entries.length,8);assert.equal(list.totals[0].display,'£8 10s. 0d.');
  assert.ok(list.entries.every(e=>e.agent_as_printed));
  assert.equal(list.entries.find(e=>e.name_as_printed.startsWith('Mr. Mozley')).amount,'');
  assert.match(list.entries.at(-1).agent_as_printed,/B\. Boam; per Mr\. M\. Boam/);
  const Export=require('../src/list-downloads.11ty.js');
  const exported=api.parse(new Export().render({list:{id:list.id}}));
  assert.equal(exported.at(-1).agent_as_printed,list.entries.at(-1).agent_as_printed);
});
test('Swansea additions omit the reprinted gifts and carry-forward',()=>{
  const db=require('../lib/db').build();const list=db.lists.find(l=>l.id==='swansea-congregation-1849-05-11-additions');
  assert.equal(list.entries.length,12);assert.match(list.notes,/Partial transcription/);
  const old=db.lists.find(l=>l.id==='swansea-congregation-1849');
  const signature=e=>[e.name_as_printed,e.amount].join('|');
  const prior=new Set(old.entries.map(signature));
  assert.ok(list.entries.every(e=>!prior.has(signature(e))));
  assert.equal(old.entries.length,43);assert.ok(list.entries.filter(e=>/\bPer\b/.test(e.section)).every(e=>e.agent_as_printed));
});

test('literary society book gifts preserve donors and both intermediaries without cash values',()=>{
  const db=require('../lib/db').build();assert.deepEqual(db.errors,[]);
  const list=db.lists.find(l=>l.id==='melbourne-hebrew-literary-books-1871-09-29');
  assert.equal(list.entries.length,18);assert.deepEqual(list.totals,[]);
  assert.ok(list.entries.every(e=>!e.amount&&!e.quantity&&e.agent_as_printed==='Messrs. B. S. Cohen and J. Harris'));
  assert.equal(list.entries.filter(e=>e.name_as_printed==='Myers and Zox').length,1);
  assert.equal(list.agents.length,2);
  const Export=require('../src/list-downloads.11ty.js');const rows=api.parse(new Export().render({list:{id:list.id}}));
  assert.equal(rows.length,18);assert.ok(rows.every(e=>e.agent_as_printed==='Messrs. B. S. Cohen and J. Harris'&&!e.amount));
});
test('listed newspaper agents retain dated appearances without being forwarded gifts',()=>{
  const db=require('../lib/db').build();
  const originals=db.entries.filter(e=>e.role==='agent');assert.ok(originals.length>0);
  const appearances=db.listedAgents.flatMap(a=>a.entries);
  assert.deepEqual(new Set(appearances.map(e=>e.id)),new Set(originals.map(e=>e.id)));
  assert.equal(appearances.length,originals.length);
  const spiel=db.listedAgents.find(a=>a.name.includes('Spielvogel'));
  assert.ok(spiel.entries.some(e=>e.list.date==='1871-07-07'));
  assert.ok(spiel.entries.some(e=>e.list.date==='1871-09-29'));
  assert.ok(spiel.entries.every(e=>/Armstrong/.test(e.note)));
  const nj=require('nunjucks');const env=new nj.Environment();
  const html=env.renderString(fs.readFileSync(path.join(root,'src/agents/index.njk'),'utf8'),{db});
  assert.match(html,/Agents listed by town/);assert.match(html,/29 September 1871/);assert.match(html,/15 Armstrong-street/);
});
test('fold-obscured Sydney amounts are not invented to reconcile the printed total',()=>{
  const db=require('../lib/db').build();const list=db.lists.find(l=>l.id==='sydney-new-synagogue-1871');
  for(const name of ['D. L. Levy','M. Levy','S. A. Ander[son]']){
    const e=list.entries.find(e=>e.name_as_printed===name);assert.equal(e.amount,'');assert.equal(e.money,null);assert.equal(e.certainty,'uncertain');assert.match(e.note,/conjectur/);
  }
  assert.match(list.notes,/printed total/i);assert.match(list.notes,/transcribed sum is incomplete/);
});

test('October-January agent lists preserve changes and count overlapping January crops once',()=>{
 const db=require('../lib/db').build();assert.deepEqual(db.errors,[]);
 const lists=db.lists.filter(l=>l.id.startsWith('australian-israelite-agents-')&&l.date>='1871-10-06'&&l.date<='1872-01-05');
 assert.equal(lists.length,13);assert.equal(lists.reduce((n,l)=>n+l.entries.length,0),51);
 assert.ok(lists.find(l=>l.date==='1871-10-06').entries.some(e=>e.name_as_printed==='Mr. W. Hopkins'));
 assert.ok(lists.filter(l=>l.date>='1871-10-13').every(l=>l.entries.some(e=>e.name_as_printed==='Mr. W. B. Lee'&&e.note.includes('87 Harrington'))));
 const jan=lists.find(l=>l.date==='1872-01-05');assert.equal(jan.entries.length,3);assert.ok(!jan.entries.some(e=>e.place_id==='launceston'));
 assert.ok(lists.every(l=>!l.totals.length));
 const input=sample();input.list.list_type='agents';input.list.currency='';input.entries[0].amount='';input.entries[0].role='';
 const result=api.validate(input,ctx);assert.deepEqual(result.errors,[]);assert.equal(result.contribution.entries[0].role,'agent');
});
test('additional donations keep explicit extra wording and officers have no invented gifts',()=>{
 const db=require('../lib/db').build();const oct6=db.lists.find(l=>l.id==='melbourne-atonement-additions-1871-10-06');
 assert.equal(oct6.entries.length,7);assert.match(oct6.entries.find(e=>e.name_as_printed==='S. Flatau').note,/extra/);
 assert.equal(db.lists.find(l=>l.id==='melbourne-atonement-additions-1871-10-13').entries.length,2);
 const officers=db.lists.find(l=>l.id==='united-friends-officers-1871-10-13');assert.equal(officers.entries.length,5);
 assert.ok(officers.entries.every(e=>e.role==='officer'&&!e.amount));assert.deepEqual(officers.totals,[]);
 const input=sample();input.entries[0].role='officer';input.entries[0].amount='';assert.deepEqual(api.validate(input,ctx).errors,[]);
});
test('Sympathy Fund distinguishes promises, receipts and damaged source readings',()=>{
 const db=require('../lib/db').build();const oct=db.lists.find(l=>l.id==='davis-sympathy-fund-1871-10-27');const nov=db.lists.find(l=>l.id==='davis-sympathy-fund-1871-11-03');
 assert.equal(oct.entries.length,138);assert.ok(oct.entries.every(e=>e.role==='pledger'));
 assert.equal(nov.entries.length,33);assert.ok(nov.entries.every(e=>e.role==='donor'));
 assert.ok(nov.entries.some(e=>e.name_as_printed==='John [surname unreadable]'&&!e.amount&&e.certainty==='uncertain'));
 assert.ok(nov.entries.some(e=>e.name_as_printed==='[name unreadable]'&&e.certainty==='uncertain'));
 assert.ok(nov.entries.filter(e=>e.section==='[Maitland?]').every(e=>e.certainty==='uncertain'));
 for(const l of [oct,nov])assert.deepEqual(l.agents.map(r=>r.name_as_printed),['M. De Lissa','H. L. Nelson']);
 assert.equal(oct.entries.find(e=>e.name_as_printed==='A. Braun').amount,'0.2.8');
 assert.equal(oct.entries.find(e=>e.name_as_printed==='B Francis').amount,'1.1.2');
});

test('petition signers keep occupations apart from payment intermediaries',()=>{
 const db=require('../lib/db').build();assert.deepEqual(db.errors,[]);
 const list=db.lists.find(l=>l.id==='stephen-street-site-petition-1872-09-13');
 assert.equal(list.entries.length,31);assert.ok(list.entries.every(e=>e.role==='signatory'&&!e.amount&&!e.agent_id&&!e.agent_as_printed));
 const raphael=list.entries.find(e=>e.name_as_printed==='Henry Raphael');assert.match(raphael.note,/estate agent/);assert.equal(raphael.place_as_printed,'St Kilda');
 assert.deepEqual(list.totals,[]);
 const input=sample();input.list.list_type='petition';input.entries[0].role='';input.entries[0].amount='';
 const result=api.validate(input,ctx);assert.deepEqual(result.errors,[]);assert.equal(result.contribution.entries[0].role,'signatory');
 const nj=require('nunjucks');const env=new nj.Environment(new nj.FileSystemLoader(path.join(root,'src/_includes')));
 const html=env.renderString(fs.readFileSync(path.join(root,'src/lists/list.njk'),'utf8'),{list,site:{}});assert.match(html,/Signatory as printed/);
});
test('Persian relief requisition and reprinted committee preserve distinct capacities',()=>{
 const db=require('../lib/db').build();const req=db.lists.find(l=>l.id==='persian-famine-requisition-1872-05-03');
 assert.equal(req.entries.length,12);assert.ok(!req.entries.some(e=>/Michaelis/.test(e.name_as_printed)));
 assert.deepEqual(req.roles.map(r=>r.role),['addressee','respondent']);assert.equal(req.agents.length,0);
 const committee=db.lists.find(l=>l.id==='persian-famine-committee-1872-05-24');
 assert.equal(committee.images.length,2);assert.equal(committee.entries.length,24);
 assert.equal(committee.entries.filter(e=>e.role==='agent').length,23);assert.equal(committee.agents.length,23);
 assert.equal(committee.entries.find(e=>e.name_as_printed==='N. S. Marks').role,'officer');
 assert.ok(!db.lists.some(l=>l.id==='persian-famine-committee-1872-05-31'));
 assert.ok(committee.entries.every(e=>!e.amount));
 const appointments=db.lists.find(l=>l.id==='melbourne-congregation-appointments-1872-04-26');
 assert.deepEqual(appointments.entries.filter(e=>e.role==='agent').map(e=>e.name_as_printed),['Mr. Lewis Collins']);
});
test('St Kilda snapshots flag cumulative amounts and preserve printed repeated and aggregate entries',()=>{
 const db=require('../lib/db').build();const build=db.lists.find(l=>l.id==='st-kilda-building-extended-1872-04-26');
 assert.match(build.notes,/cumulative/);assert.match(build.notes,/st-kilda-hebrew-congregation-1871/);
 const con=db.lists.find(l=>l.id==='st-kilda-consecration-donations-1872-10-11');
 assert.deepEqual(con.entries.filter(e=>e.name_as_printed==='Joseph Cohen').map(e=>e.amount),['2.0.0','1.1.0']);
 const cash=con.entries.find(e=>e.name_as_printed==='Cash');assert.equal(cash.amount,'6.8.6');assert.match(cash.note,/Aggregate/);
 assert.equal(con.entries.find(e=>e.name_as_printed==='Mrs. I. Benjamin').amount,'0.2.0');
 const exports=require('../src/list-downloads.11ty.js');const rows=api.parse(new exports().render({list:{id:con.id}}));
 assert.equal(rows.filter(e=>e.name_as_printed==='Joseph Cohen').length,2);assert.equal(rows.at(-1).amount,'6.8.6');
});

test('late 1872 newspaper agents retain the dated address change and England agent',()=>{
 const db=require('../lib/db').build();assert.deepEqual(db.errors,[]);
 const before=db.lists.find(l=>l.id==='australian-israelite-agents-1872-12-06');const after=db.lists.find(l=>l.id==='australian-israelite-agents-1872-12-13');
 assert.match(before.entries[0].note,/87 Harrington/);assert.match(after.entries[0].note,/158 Castlereagh/);
 const dec20=db.lists.find(l=>l.id==='australian-israelite-agents-1872-12-20');assert.equal(dec20.entries.length,4);
 const england=dec20.entries.find(e=>e.name_as_printed==='Publisher of Jewish Chronicle');assert.equal(england.place_id,'london');assert.match(england.note,/43 Finsbury/);assert.equal(england.entity_id,'');
});
test('the ball roster preserves reprinted evidence and distinct capacities without donor amounts',()=>{
 const db=require('../lib/db').build();const ball=db.lists.find(l=>l.id==='st-kilda-ball-roster-1872-11-08');
 assert.equal(ball.roles.filter(r=>r.role==='steward').length,29);assert.equal(ball.images.length,2);assert.equal(ball.entries.length,54);assert.ok(ball.entries.every(e=>e.role==='officer'&&!e.amount));assert.deepEqual(ball.totals,[]);
 assert.deepEqual(ball.entries.filter(e=>e.name_as_printed==='D. Benjamin, Esq.').map(e=>e.section),['Stewards','Committee']);
 assert.ok(!db.lists.some(l=>l.id==='st-kilda-ball-roster-1872-11-15'));
 assert.equal(ball.roles.find(r=>r.role==='hon-secretary').address_as_printed,'11 Collins-street west');
});
test('explicit second gifts and ditto referents survive individual-list CSV download',()=>{
 const db=require('../lib/db').build();const list=db.lists.find(l=>l.id==='melbourne-atonement-donations-1872-10-18');
 const second=list.entries.filter(e=>e.name_as_printed==='„ „ second donation');assert.deepEqual(second.map(e=>e.amount),['5.5.0','10.10.0']);
 assert.match(second[0].note,/Simeon Cohen/);assert.match(second[1].note,/J\. Kronheimer/);
 const Export=require('../src/list-downloads.11ty.js');const rows=api.parse(new Export().render({list:{id:list.id}}));
 assert.deepEqual(rows.filter(e=>e.name_as_printed==='„ „ second donation').map(e=>[e.amount,e.note]),second.map(e=>[e.amount,e.note]));
});
