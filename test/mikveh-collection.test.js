const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {parse}=require('csv-parse/sync');
const db=require('../lib/db').build();
const collection=require('../src/_data/mikvehCollection.json');
test('all 37 OPenn collection items resolve to unique catalogue sources and all supplied scans are registered',()=>{
 assert.equal(collection.records.length,37);
 assert.equal(new Set(collection.records.map(r=>r.source_id)).size,37);
 for(const r of collection.records){assert.ok(db.sources.some(s=>s.id===r.source_id));assert.notEqual(r.status,'Complete');assert.ok(r.dates);}
 const scans=parse(fs.readFileSync(path.join(__dirname,'../src/assets/reviews/mikveh-israel/page-inventory.csv'),'utf8'),{columns:true});
 assert.equal(scans.length,3627);
 assert.equal(new Set(scans.map(p=>p.web_image_url)).size,3627);
 assert.ok(scans.every(p=>/^https:\/\/openn\.library\.upenn\.edu\//.test(p.web_image_url)&&p.sha256.length===64));
 assert.equal(scans.filter(p=>p.transcription_status!=='not transcribed').length,collection.selected_scans);
 assert.equal(collection.records.reduce((n,r)=>n+r.scans,0),scans.length);
});
test('memorial names remain distinct source appearances and cannot become donors or inferred identities',()=>{
 const l=db.lists.find(l=>l.id==='mikveh-israel-monthly-memorials-1785');
 assert.equal(l.entries.length,35);assert.equal(l.totals.length,0);
 assert.ok(l.entries.every(e=>e.role==='commemorated'&&!e.amount&&!e.entity_id));
 const g=l.entries.find(e=>e.name_as_printed==='Daniel Gomez');assert.ok(g);assert.equal(g.entity_id,'');
 assert.match(l.notes,/struck-through/);
});
test('the invitation preserves its conflicting date evidence and the charter does not invent contribution amounts',()=>{
 const invitation=db.lists.find(l=>l.id==='mikveh-israel-consecration-invitation-officers-1866');
 assert.equal(invitation.entries.length,5);assert.match(invitation.notes,/5620/);assert.match(invitation.notes,/unresolved/);
 const charter=db.lists.find(l=>l.id==='beth-el-emeth-charter-signatures-1857');
 assert.equal(charter.entries.length,61);assert.ok(charter.entries.every(e=>!e.amount&&!e.entity_id&&e.role==='signatory'));
 assert.match(charter.notes,/undated additions/);
 assert.ok(charter.entries.some(e=>e.certainty==='uncertain'));
});
test('future memorial imports default to commemorated people rather than donations',()=>{
 const api=require('../src/assets/contribution');
 const input={version:1,list:{id:'test-monthly-memorial',title:'Monthly memorials',list_type:'memorial',source_id:db.sources[0].id,date:'1785'},entries:[{name_as_printed:'A. Commemorated',certainty:'certain'}]};
 const result=api.validate(input,api.context(db));
 assert.deepEqual(result.errors,[]);
 assert.equal(result.contribution.entries[0].role,'commemorated');
});
