const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {parse}=require('csv-parse/sync');
const root=path.join(__dirname,'..');
const read=name=>parse(fs.readFileSync(path.join(root,'data',name+'.csv'),'utf8'),{columns:true,skip_empty_lines:true});
test('Boston honor roll and pledge directory keep every row within two complete lists',()=>{
 const lists=read('lists').filter(l=>l.source_id==='combined-jewish-appeal-boston-yearbook-1945');
 const entries=read('entries').filter(e=>e.list_id.startsWith('boston-cja1945-'));
 assert.equal(lists.length,13);assert.equal(entries.length,39875);
 assert.equal(new Set(entries.map(e=>e.id)).size,39875);
 for(const [id,count] of [['boston-cja1945-honor-roll',16276],['boston-cja1945-pledges',22715]]){
  const rows=entries.filter(e=>e.list_id===id);assert.equal(rows.length,count);
  assert.deepEqual(rows.map(e=>Number(e.seq)).sort((a,b)=>a-b),Array.from({length:count},(_,i)=>i+1));
 }
 const honor=entries.filter(e=>e.list_id==='boston-cja1945-honor-roll');
 assert.equal(new Set(honor.map(e=>e.section)).size,26);
 assert.ok(honor.some(e=>e.section==='Woburn'));
 assert.ok(honor.some(e=>e.section==='Boston'&&e.note.includes('died in service')));
 assert.ok(honor.every(e=>e.page&&e.column));
 const redirects=require('../src/_data/listRedirects.json');assert.equal(redirects.length,76);
 const ids=new Set(lists.map(l=>l.id));
 for(const r of redirects){assert.ok(ids.has(r.to_id));assert.ok(!ids.has(r.from_id));}
});

test('charter amounts include cents and distinguish unpriced cross-references',()=>{
 const rows=read('entries').filter(e=>e.list_id==='boston-cja1945-charter');
 assert.equal(rows.length,497);assert.equal(rows.filter(e=>e.amount).length,490);
 assert.ok(rows.filter(e=>!e.amount).every(e=>/see /i.test(e.name_as_printed)));
 for(const [suffix,amount] of [['00023','0.50'],['00037','0.15'],['00069','0.10'],['00059','16.00'],['00497','2.00']])
  assert.equal(rows.find(e=>e.id.endsWith(suffix)).amount,amount);
 assert.ok(rows.filter(e=>e.amount).every(e=>e.currency==='USD'));
});
